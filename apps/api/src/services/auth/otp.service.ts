import { randomInt } from 'node:crypto';
import { redis } from '../../lib/redis.js';
import { sha256 } from '../../lib/hash.js';

const OTP_TTL = 300; // 5 minutes
const MAX_ATTEMPTS = 3;
const LOCKOUT_TTL = 900; // 15 minutes
const RATE_LIMIT_WINDOW = 600; // 10 minutes
const RATE_LIMIT_MAX = 3;

function otpKey(identifierHash: string, purpose: string): string {
  return `otp:${purpose}:${identifierHash}`;
}

function lockoutKey(identifierHash: string): string {
  return `otp:lockout:${identifierHash}`;
}

function rateLimitKey(identifierHash: string): string {
  return `otp:ratelimit:${identifierHash}`;
}

export async function generateOtp(
  identifier: string,
  purpose: string,
): Promise<{ otpHash: string; code: string } | { error: string }> {
  const identifierHash = sha256(identifier);

  const locked = await redis.get(lockoutKey(identifierHash));
  if (locked) {
    return { error: 'Too many failed attempts. Try again later.' };
  }

  const rateLimitCount = await redis.get(rateLimitKey(identifierHash));
  if (rateLimitCount && parseInt(rateLimitCount, 10) >= RATE_LIMIT_MAX) {
    return { error: 'OTP rate limit exceeded. Try again later.' };
  }

  const code = randomInt(100000, 999999).toString();
  const otpHash = sha256(code);
  const key = otpKey(identifierHash, purpose);

  const data = JSON.stringify({ otpHash, attempts: 0 });
  await redis.set(key, data, 'EX', OTP_TTL);

  const rlKey = rateLimitKey(identifierHash);
  const currentCount = await redis.incr(rlKey);
  if (currentCount === 1) {
    await redis.expire(rlKey, RATE_LIMIT_WINDOW);
  }

  return { otpHash, code };
}

export async function verifyOtp(
  identifier: string,
  purpose: string,
  code: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const identifierHash = sha256(identifier);

  const locked = await redis.get(lockoutKey(identifierHash));
  if (locked) {
    return { valid: false, error: 'Account locked. Try again later.' };
  }

  const key = otpKey(identifierHash, purpose);
  const raw = await redis.get(key);
  if (!raw) {
    return { valid: false, error: 'OTP expired or not found' };
  }

  const stored = JSON.parse(raw) as { otpHash: string; attempts: number };
  const inputHash = sha256(code);

  if (inputHash !== stored.otpHash) {
    stored.attempts += 1;
    if (stored.attempts >= MAX_ATTEMPTS) {
      await redis.del(key);
      await redis.set(lockoutKey(identifierHash), '1', 'EX', LOCKOUT_TTL);
      return { valid: false, error: 'Max attempts exceeded. Account locked for 15 minutes.' };
    }
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(stored), 'EX', ttl > 0 ? ttl : OTP_TTL);
    return { valid: false, error: `Invalid OTP. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.` };
  }

  await redis.del(key);
  return { valid: true };
}
