import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  };
  return { mockRedis };
});

vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));

import { generateOtp, verifyOtp } from '../otp.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateOtp', () => {
  it('returns a 6-digit code and its hash', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const result = await generateOtp('9876543210', 'login');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('otpHash');
    if ('code' in result) {
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.otpHash).toHaveLength(64);
    }
  });

  it('returns error when locked out', async () => {
    mockRedis.get.mockResolvedValueOnce('1');
    const result = await generateOtp('9876543210', 'login');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toMatch(/too many/i);
    }
  });

  it('returns error when rate limited', async () => {
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('3');
    const result = await generateOtp('9876543210', 'login');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toMatch(/rate limit/i);
    }
  });
});

describe('verifyOtp', () => {
  it('returns valid:true for correct code', async () => {
    const { createHash } = await import('node:crypto');
    const code = '123456';
    const otpHash = createHash('sha256').update(code).digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash, attempts: 0 }));
    mockRedis.del.mockResolvedValue(1);

    const result = await verifyOtp('9876543210', 'login', code);
    expect(result).toEqual({ valid: true });
  });

  it('returns error for wrong code and decrements attempts', async () => {
    const { createHash } = await import('node:crypto');
    const realHash = createHash('sha256').update('123456').digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash: realHash, attempts: 0 }));
    mockRedis.ttl.mockResolvedValue(240);
    mockRedis.set.mockResolvedValue('OK');

    const result = await verifyOtp('9876543210', 'login', '000000');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toMatch(/2 attempts remaining/);
    }
  });

  it('locks out after 3 failed attempts', async () => {
    const { createHash } = await import('node:crypto');
    const realHash = createHash('sha256').update('123456').digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash: realHash, attempts: 2 }));
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    const result = await verifyOtp('9876543210', 'login', '000000');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toMatch(/locked/i);
    }
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining('lockout'),
      '1',
      'EX',
      900,
    );
  });

  it('returns error when OTP expired', async () => {
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await verifyOtp('9876543210', 'login', '123456');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toMatch(/expired/i);
    }
  });

  it('returns error when account is locked', async () => {
    mockRedis.get.mockResolvedValueOnce('1');

    const result = await verifyOtp('9876543210', 'login', '123456');
    expect(result).toHaveProperty('valid', false);
    if (!result.valid) {
      expect(result.error).toMatch(/locked/i);
    }
  });
});
