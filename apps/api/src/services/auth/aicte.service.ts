import { prisma } from '../../lib/prisma.js';
import { sha256, generateSessionId } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, type TokenPayload } from '../../lib/jwt.js';
import { redis } from '../../lib/redis.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { generateOtp, verifyOtp } from './otp.service.js';

const AICTE_SESSION_TTL = 4 * 60 * 60; // 4 hours
const AICTE_ACCESS_EXPIRY_MS = 4 * 60 * 60 * 1000;

export async function sendAicteOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: {
      email_hash: emailHash,
      role: { in: ['AICTE_ADMIN', 'AICTE_REVIEWER'] },
      is_active: true,
    },
    select: { id: true },
  });

  if (!user) {
    return { success: true };
  }

  const result = await generateOtp(email, 'aicte_login');
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] AICTE OTP for ${emailHash.slice(0, 8)}...: ${result.code}`);
  }

  return { success: true };
}

export async function verifyAicteOtp(
  email: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string; fido2Required: boolean } | { error: string }> {
  const otpResult = await verifyOtp(email, 'aicte_login', code);
  if (!otpResult.valid) {
    return { error: otpResult.error };
  }

  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: {
      email_hash: emailHash,
      role: { in: ['AICTE_ADMIN', 'AICTE_REVIEWER'] },
      is_active: true,
    },
    select: { id: true, role: true },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  // Enforce 1 concurrent session: revoke any existing session
  const existingSessionId = await redis.get(`aicte:active_session:${user.id}`);
  if (existingSessionId) {
    await redis.set(`revoked:session:${existingSessionId}`, '1', 'EX', AICTE_SESSION_TTL);
    await redis.del(`session:${existingSessionId}`);
  }

  const sessionId = generateSessionId();
  const payload: TokenPayload = { sub: user.id, role: user.role, sessionId };

  await redis.set(`session:${sessionId}`, user.id, 'EX', AICTE_SESSION_TTL);
  await redis.set(`aicte:active_session:${user.id}`, sessionId, 'EX', AICTE_SESSION_TTL);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await writeAuditEvent({
    actorId: user.id,
    action: 'LOGIN',
    targetTable: 'users',
    targetId: user.id,
    ipAddress,
    userAgent,
  });

  // FIDO2 stub: post-hackathon, real WebAuthn challenge issued here
  return { accessToken, refreshToken, fido2Required: true };
}
