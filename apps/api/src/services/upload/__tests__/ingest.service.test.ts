import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    programme: { findFirst: vi.fn() },
    student: { upsert: vi.fn() },
    admission: { findUnique: vi.fn(), create: vi.fn() },
    upload: { update: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: {
    lpush: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test' },
}));

import { ingestRecords } from '../ingest.service.js';
import type { AdmissionRecord } from '../transform.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
  mockPrisma.upload.update.mockResolvedValue({});
});

const makeRecord = (apaarId: string): AdmissionRecord => ({
  apaarId,
  studentName: 'Test Student',
  dateOfBirth: '2000-01-01',
  gender: 'male',
  programmeCode: 'BTECH-CSE',
  academicYear: '2025-26',
});

describe('ingestRecords', () => {
  it('creates admission for valid record', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.student.upsert.mockResolvedValue({ id: 'student-1' });
    mockPrisma.admission.findUnique.mockResolvedValue(null);
    mockPrisma.admission.create.mockResolvedValue({ id: 'adm-1' });

    const result = await ingestRecords(
      'upload-1', 'inst-1', 'user-1',
      [makeRecord('123456789012')],
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('skips duplicate APAAR+year within same upload', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.student.upsert.mockResolvedValue({ id: 'student-1' });
    mockPrisma.admission.findUnique.mockResolvedValue(null);
    mockPrisma.admission.create.mockResolvedValue({ id: 'adm-1' });

    const result = await ingestRecords(
      'upload-1', 'inst-1', 'user-1',
      [makeRecord('123456789012'), makeRecord('123456789012')],
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/Duplicate/);
  });

  it('fails when programme not found', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue(null);

    const result = await ingestRecords(
      'upload-1', 'inst-1', 'user-1',
      [makeRecord('123456789012')],
    );

    expect(result.created).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].reason).toMatch(/Programme/);
  });

  it('skips when admission already exists in DB', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.student.upsert.mockResolvedValue({ id: 'student-1' });
    mockPrisma.admission.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await ingestRecords(
      'upload-1', 'inst-1', 'user-1',
      [makeRecord('123456789012')],
    );

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('enqueues APAAR validation after creation', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.student.upsert.mockResolvedValue({ id: 'student-1' });
    mockPrisma.admission.findUnique.mockResolvedValue(null);
    mockPrisma.admission.create.mockResolvedValue({ id: 'adm-1' });

    await ingestRecords('upload-1', 'inst-1', 'user-1', [makeRecord('123456789012')]);

    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'queue:apaar-validation',
      expect.stringContaining('adm-1'),
    );
  });

  it('updates upload status to COMPLETED', async () => {
    mockPrisma.programme.findFirst.mockResolvedValue({ id: 'prog-1' });
    mockPrisma.student.upsert.mockResolvedValue({ id: 'student-1' });
    mockPrisma.admission.findUnique.mockResolvedValue(null);
    mockPrisma.admission.create.mockResolvedValue({ id: 'adm-1' });

    await ingestRecords('upload-1', 'inst-1', 'user-1', [makeRecord('123456789012')]);

    expect(mockPrisma.upload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'upload-1' },
        data: expect.objectContaining({ status: 'COMPLETED', created_count: 1 }),
      }),
    );
  });
});
