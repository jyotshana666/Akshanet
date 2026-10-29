import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockValidateApaar, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: {
    lpush: vi.fn(),
    zadd: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  mockValidateApaar: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/apaar.js', () => ({ validateApaar: mockValidateApaar }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../lib/stateMachine.js', () => ({
  canTransition: vi.fn(() => ({ ok: true })),
  transition: vi.fn(),
}));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', APAAR_MOCK: true },
}));

import { validateRecord, processBatch } from '../validation.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
  mockRedis.zadd.mockResolvedValue(1);
  mockPrisma.admission.update.mockResolvedValue({});
});

const makeAdmission = (id = 'adm-1', apaarId = '123456789012') => ({
  id,
  apaar_id: apaarId,
  institution_id: 'inst-1',
  student: {
    name: 'Test Student',
    date_of_birth: new Date('2000-01-01'),
    gender: 'male',
  },
});

describe('validateRecord', () => {
  it('returns verified on successful validation', async () => {
    mockValidateApaar.mockResolvedValue({
      active: true,
      match: true,
      fields: { name: true, dob: true, gender: true },
    });

    const result = await validateRecord(makeAdmission());
    expect(result).toBe('verified');
  });

  it('returns mismatch on data mismatch', async () => {
    mockValidateApaar.mockResolvedValue({
      active: true,
      match: false,
      fields: { name: false, dob: true, gender: true },
    });

    const result = await validateRecord(makeAdmission());
    expect(result).toBe('mismatch');
  });

  it('returns not_found when APAAR inactive', async () => {
    mockValidateApaar.mockResolvedValue({
      active: false,
      match: false,
      fields: { name: false, dob: false, gender: false },
    });

    const result = await validateRecord(makeAdmission());
    expect(result).toBe('not_found');
  });

  it('returns retry on API error', async () => {
    mockValidateApaar.mockRejectedValue(new Error('API timeout'));

    const result = await validateRecord(makeAdmission(), 0);
    expect(result).toBe('retry');
  });

  it('returns not_found after max retries', async () => {
    mockValidateApaar.mockRejectedValue(new Error('API timeout'));

    const result = await validateRecord(makeAdmission(), 48);
    expect(result).toBe('not_found');
  });
});

describe('processBatch', () => {
  it('processes all DRAFT records in upload', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      makeAdmission('adm-1'),
      makeAdmission('adm-2', '234567890123'),
    ]);
    mockValidateApaar.mockResolvedValue({
      active: true,
      match: true,
      fields: { name: true, dob: true, gender: true },
    });
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'draft',
      institution_id: 'inst-1',
    });

    const result = await processBatch('upload-1');
    expect(result.processed).toBe(2);
    expect(result.verified).toBe(2);
  });

  it('counts mismatches separately', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([makeAdmission()]);
    mockValidateApaar.mockResolvedValue({
      active: true,
      match: false,
      fields: { name: false, dob: true, gender: true },
    });

    const result = await processBatch('upload-1');
    expect(result.mismatched).toBe(1);
    expect(result.verified).toBe(0);
  });
});
