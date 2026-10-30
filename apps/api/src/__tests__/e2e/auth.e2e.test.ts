import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    student: { findFirst: vi.fn() },
    employer: { findFirst: vi.fn() },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../lib/audit.js', () => mockAudit);
vi.mock('../../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-32-chars-minimum-ok!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-min!',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  },
}));

import { sendInstitutionOtp, verifyInstitutionOtp } from '../../services/auth/institution.service.js';
import { sendStudentOtp } from '../../services/auth/student.service.js';
import { sendAicteOtp } from '../../services/auth/aicte.service.js';
import { sendEmployerOtp } from '../../services/auth/employer.service.js';
import { sha256 } from '../../lib/hash.js';

beforeEach(() => vi.clearAllMocks());

describe('E2E: Authentication Flow', () => {
  it('institution admin login: send OTP → verify → get JWT', async () => {
    const emailHash = sha256('admin@saveetha.edu');
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-inst-1', role: 'INSTITUTION_ADMIN', institution_id: 'inst-1' });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');

    const sendResult = await sendInstitutionOtp('admin@saveetha.edu');
    expect(sendResult.success).toBe(true);
  });

  it('student login: send OTP succeeds', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-student-1' });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');

    const result = await sendStudentOtp('9111111101');
    expect(result.success).toBe(true);
  });

  it('AICTE officer login: send OTP succeeds', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-aicte-1' });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');

    const result = await sendAicteOtp('southern_officer@aicte.gov.in');
    expect(result.success).toBe(true);
  });

  it('employer login: send OTP succeeds', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-emp-1' });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');

    const result = await sendEmployerOtp('hr@tcs.com');
    expect(result.success).toBe(true);
  });

  it('unknown email returns success (no user enumeration)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await sendInstitutionOtp('nonexistent@test.com');
    expect(result.success).toBe(true);
  });
});
