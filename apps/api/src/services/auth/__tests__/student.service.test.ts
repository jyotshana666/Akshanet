import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    student: { findUnique: vi.fn(), create: vi.fn() },
    consent: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
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

import { sendStudentOtp, verifyStudentOtp, registerStudent } from '../student.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendStudentOtp', () => {
  it('returns success even if user not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await sendStudentOtp('9876543210');
    expect(result.success).toBe(true);
  });
});

describe('verifyStudentOtp', () => {
  it('returns error for expired OTP', async () => {
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const result = await verifyStudentOtp('9876543210', '000000');
    expect(result).toHaveProperty('error');
  });
});

describe('registerStudent', () => {
  it('returns error if APAAR ID already exists', async () => {
    mockPrisma.student.findUnique.mockResolvedValue({ id: 'existing' });
    const result = await registerStudent({
      apaarId: '123456789012',
      name: 'Test Student',
      dateOfBirth: '2000-01-01',
      mobile: '9876543210',
      collegeEmail: 'test@college.edu',
    });
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toMatch(/already exists/i);
    }
  });

  it('returns error if mobile already registered', async () => {
    mockPrisma.student.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });
    const result = await registerStudent({
      apaarId: '123456789012',
      name: 'Test Student',
      dateOfBirth: '2000-01-01',
      mobile: '9876543210',
      collegeEmail: 'test@college.edu',
    });
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toMatch(/already registered/i);
    }
  });

  it('creates student, user, and consent in transaction', async () => {
    mockPrisma.student.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue({
      userId: 'user-1',
      studentId: 'student-1',
    });

    const result = await registerStudent({
      apaarId: '123456789012',
      name: 'Test Student',
      dateOfBirth: '2000-01-01',
      mobile: '9876543210',
      collegeEmail: 'test@college.edu',
    });
    expect(result).toHaveProperty('userId', 'user-1');
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
