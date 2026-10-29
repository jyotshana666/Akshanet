import { redis } from '../../lib/redis.js';
import { verifyRefreshToken, signAccessToken, signRefreshToken, type TokenPayload } from '../../lib/jwt.js';
import { generateSessionId } from '../../lib/hash.js';
import { writeAuditEvent } from '../../lib/audit.js';

export async function refreshTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string }> {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return { error: 'Invalid refresh token' };
  }

  const sessionOwner = await redis.get(`session:${payload.sessionId}`);
  if (!sessionOwner || sessionOwner !== payload.sub) {
    return { error: 'Session expired or revoked' };
  }

  const revoked = await redis.get(`revoked:session:${payload.sessionId}`);
  if (revoked) {
    return { error: 'Session revoked' };
  }

  // Rotate session
  await redis.del(`session:${payload.sessionId}`);
  const newSessionId = generateSessionId();

  const newPayload: TokenPayload = {
    sub: payload.sub,
    role: payload.role,
    institutionId: payload.institutionId,
    sessionId: newSessionId,
  };

  await redis.set(`session:${newSessionId}`, payload.sub, 'EX', 7 * 24 * 60 * 60);

  return {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  };
}

export async function logout(
  userId: string,
  sessionId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await redis.set(`revoked:session:${sessionId}`, '1', 'EX', 7 * 24 * 60 * 60);
  await redis.del(`session:${sessionId}`);

  await writeAuditEvent({
    actorId: userId,
    action: 'LOGOUT',
    targetTable: 'users',
    targetId: userId,
    ipAddress,
    userAgent,
  });
}
