import { prisma } from '../../lib/prisma.js';
import { sha256, generateSessionId } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, type TokenPayload } from '../../lib/jwt.js';
import { redis } from '../../lib/redis.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { generateOtp, verifyOtp } from './otp.service.js';

export async function sendInstitutionOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: {
      email_hash: emailHash,
      role: { in: ['INSTITUTION_ADMIN', 'INSTITUTION_STAFF'] },
      is_active: true,
    },
    select: { id: true },
  });

  if (!user) {
    return { success: true };
  }

  const result = await generateOtp(email, 'institution_login');
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  // In production: send email via SES/SMTP. For now, log in dev only.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Institution OTP for ${emailHash.slice(0, 8)}...: ${result.code}`);
  }

  return { success: true };
}

export async function verifyInstitutionOtp(
  email: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string }> {
  const otpResult = await verifyOtp(email, 'institution_login', code);
  if (!otpResult.valid) {
    return { error: otpResult.error };
  }

  const emailHash = sha256(email);
  const user = await prisma.user.findFirst({
    where: {
      email_hash: emailHash,
      role: { in: ['INSTITUTION_ADMIN', 'INSTITUTION_STAFF'] },
      is_active: true,
    },
    select: { id: true, role: true, institution_id: true },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  const sessionId = generateSessionId();
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    institutionId: user.institution_id ?? undefined,
    sessionId,
  };

  await redis.set(`session:${sessionId}`, user.id, 'EX', 7 * 24 * 60 * 60);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await writeAuditEvent({
    actorId: user.id,
    institutionId: user.institution_id ?? undefined,
    action: 'LOGIN',
    targetTable: 'users',
    targetId: user.id,
    ipAddress,
    userAgent,
  });

  return { accessToken, refreshToken };
}
