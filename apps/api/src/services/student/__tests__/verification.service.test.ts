import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockTransition, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    flag: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: { lpush: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn() },
  mockTransition: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/stateMachine.js', () => ({
  canTransition: vi.fn(() => ({ ok: true })),
  transition: mockTransition,
}));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import { verifyRecord, flagRecord, getFlags } from '../verification.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
  mockPrisma.admission.update.mockResolvedValue({});
  mockTransition.mockResolvedValue(undefined);
});

describe('verifyRecord', () => {
  it('verifies record in APAAR_VERIFIED state', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
      student: { name: 'Test' },
    });

    const result = await verifyRecord('adm-1', 'student-1', '123456789012');
    expect(result.verified).toBe(true);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(), 'adm-1', 'student_verified', 'student-1', 'STUDENT',
    );
  });

  it('verifies record in ANOMALY_WATCH state', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'anomaly_watch',
      institution_id: 'inst-1',
      student: { name: 'Test' },
    });

    const result = await verifyRecord('adm-1', 'student-1', '123456789012');
    expect(result.verified).toBe(true);
  });

  it('rejects verification from wrong state', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'draft',
      institution_id: 'inst-1',
      student: { name: 'Test' },
    });

    const result = await verifyRecord('adm-1', 'student-1', '123456789012');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('Cannot verify');
  });

  it('rejects when admission not found', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue(null);
    const result = await verifyRecord('adm-999', 'student-1', '123456789012');
    expect(result.verified).toBe(false);
  });

  it('sends notification to institution', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
      student: { name: 'Test Student' },
    });

    await verifyRecord('adm-1', 'student-1', '123456789012');
    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'queue:notification',
      expect.stringContaining('student_verified'),
    );
  });
});

describe('flagRecord', () => {
  it('creates flag and transitions to STUDENT_FLAGGED', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
    });
    mockPrisma.flag.create.mockResolvedValue({ id: 'flag-1' });

    const result = await flagRecord('adm-1', 'student-1', '123456789012', 'name', 'Wrong spelling');
    expect(result.flagged).toBe(true);
    expect(result.flagId).toBe('flag-1');
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(), 'adm-1', 'student_flagged', 'student-1', 'STUDENT',
    );
  });

  it('rejects flag from wrong state', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'draft',
      institution_id: 'inst-1',
    });

    const result = await flagRecord('adm-1', 'student-1', '123456789012', 'name', 'Reason');
    expect(result.flagged).toBe(false);
  });
});

describe('getFlags', () => {
  it('returns all flags for student', async () => {
    mockPrisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-1',
        admission_id: 'adm-1',
        field_name: 'name',
        reason: 'Incorrect',
        status: 'OPEN',
        created_at: new Date('2025-06-15'),
      },
    ]);

    const flags = await getFlags('student-1');
    expect(flags).toHaveLength(1);
    expect(flags[0].fieldName).toBe('name');
  });
});
