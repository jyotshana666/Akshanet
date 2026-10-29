import { prisma } from '../../lib/prisma.js';
import { sha256, generateSessionId } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, type TokenPayload } from '../../lib/jwt.js';
import { redis } from '../../lib/redis.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { generateOtp, verifyOtp } from './otp.service.js';

export async function sendEmployerOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: { email_hash: emailHash, role: 'EMPLOYER', is_active: true },
    select: { id: true },
  });

  if (!user) {
    return { success: true };
  }

  const result = await generateOtp(email, 'employer_login');
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Employer OTP for ${emailHash.slice(0, 8)}...: ${result.code}`);
  }

  return { success: true };
}

export async function verifyEmployerOtp(
  email: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string }> {
  const otpResult = await verifyOtp(email, 'employer_login', code);
  if (!otpResult.valid) {
    return { error: otpResult.error };
  }

  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: { email_hash: emailHash, role: 'EMPLOYER', is_active: true },
    select: { id: true, role: true },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  // Employer accounts require manual approval — check Redis flag
  const approved = await redis.get(`employer:approved:${user.id}`);
  if (!approved) {
    const pending = await redis.get(`employer:pending:${user.id}`);
    if (!pending) {
      await redis.set(`employer:pending:${user.id}`, '1');
    }
    return { error: 'Account pending approval. You will be notified once approved.' };
  }

  const sessionId = generateSessionId();
  const payload: TokenPayload = { sub: user.id, role: user.role, sessionId };

  await redis.set(`session:${sessionId}`, user.id, 'EX', 7 * 24 * 60 * 60);

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

  return { accessToken, refreshToken };
}
