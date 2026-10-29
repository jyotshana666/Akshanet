import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findFirst: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../../config.js', () => ({
  config: {
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
  },
}));

import { sendInstitutionOtp, verifyInstitutionOtp } from '../institution.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendInstitutionOtp', () => {
  it('returns success even if user not found (no email enumeration)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await sendInstitutionOtp('unknown@test.com');
    expect(result.success).toBe(true);
  });

  it('generates OTP when user exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const result = await sendInstitutionOtp('admin@college.edu');
    expect(result.success).toBe(true);
  });
});

describe('verifyInstitutionOtp', () => {
  it('returns error for invalid OTP', async () => {
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await verifyInstitutionOtp('admin@college.edu', '000000');
    expect(result).toHaveProperty('error');
  });

  it('returns tokens on valid OTP and user found', async () => {
    const { createHash } = await import('node:crypto');
    const code = '123456';
    const otpHash = createHash('sha256').update(code).digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash, attempts: 0 }));
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      role: 'INSTITUTION_ADMIN',
      institution_id: 'inst-1',
    });

    const result = await verifyInstitutionOtp('admin@college.edu', code);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});
