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

import { sendEmployerOtp, verifyEmployerOtp } from '../employer.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendEmployerOtp', () => {
  it('returns success even if user not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await sendEmployerOtp('hr@company.com');
    expect(result.success).toBe(true);
  });
});

describe('verifyEmployerOtp', () => {
  it('returns pending approval error for unapproved employer', async () => {
    const { createHash } = await import('node:crypto');
    const code = '123456';
    const otpHash = createHash('sha256').update(code).digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash, attempts: 0 }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'emp-1',
      role: 'EMPLOYER',
    });

    const result = await verifyEmployerOtp('hr@company.com', code);
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toMatch(/pending approval/i);
    }
  });

  it('returns tokens for approved employer', async () => {
    const { createHash } = await import('node:crypto');
    const code = '654321';
    const otpHash = createHash('sha256').update(code).digest('hex');

    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ otpHash, attempts: 0 }))
      .mockResolvedValueOnce('1');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'emp-1',
      role: 'EMPLOYER',
    });

    const result = await verifyEmployerOtp('hr@company.com', code);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});
