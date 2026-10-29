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

import { sendAicteOtp, verifyAicteOtp } from '../aicte.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendAicteOtp', () => {
  it('returns success even if user not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await sendAicteOtp('officer@aicte.gov.in');
    expect(result.success).toBe(true);
  });
});

describe('verifyAicteOtp', () => {
  it('revokes existing session before creating new one (1 concurrent session)', async () => {
    const { createHash } = await import('node:crypto');
    const code = '123456';
    const otpHash = createHash('sha256').update(code).digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash, attempts: 0 }))
      .mockResolvedValueOnce('old-session-id');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'aicte-1',
      role: 'AICTE_ADMIN',
    });

    const result = await verifyAicteOtp('officer@aicte.gov.in', code);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('fido2Required', true);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'revoked:session:old-session-id',
      '1',
      'EX',
      14400,
    );
  });

  it('returns error for invalid OTP', async () => {
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await verifyAicteOtp('officer@aicte.gov.in', '000000');
    expect(result).toHaveProperty('error');
  });
});
