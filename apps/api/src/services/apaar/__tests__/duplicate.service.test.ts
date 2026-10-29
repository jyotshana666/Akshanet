import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    duplicatePair: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: {
    lpush: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../lib/stateMachine.js', () => ({
  canTransition: vi.fn(() => ({ ok: true })),
  transition: vi.fn(),
}));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test' },
}));

import { checkDuplicate, resolveDuplicate } from '../duplicate.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
});

describe('checkDuplicate', () => {
  it('returns no duplicate when none found', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([]);

    const result = await checkDuplicate('123456789012', '2025-26', 'inst-1', 'adm-1');
    expect(result.duplicate).toBe(false);
  });

  it('flags duplicate at different institution', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-other', institution_id: 'inst-2' },
    ]);
    mockPrisma.duplicatePair.create.mockResolvedValue({ id: 'pair-1' });
    mockPrisma.admission.findUnique.mockResolvedValue({
      verification_status: 'apaar_verified',
    });

    const result = await checkDuplicate('123456789012', '2025-26', 'inst-1', 'adm-1');
    expect(result.duplicate).toBe(true);
    expect(result.pairId).toBe('pair-1');
  });

  it('creates DuplicatePair record', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-other', institution_id: 'inst-2' },
    ]);
    mockPrisma.duplicatePair.create.mockResolvedValue({ id: 'pair-1' });
    mockPrisma.admission.findUnique.mockResolvedValue({
      verification_status: 'apaar_verified',
    });

    await checkDuplicate('123456789012', '2025-26', 'inst-1', 'adm-1');

    expect(mockPrisma.duplicatePair.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apaar_id: '123456789012',
          admission_id_a: 'adm-1',
          admission_id_b: 'adm-other',
        }),
      }),
    );
  });

  it('sends notifications to both institutions', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-other', institution_id: 'inst-2' },
    ]);
    mockPrisma.duplicatePair.create.mockResolvedValue({ id: 'pair-1' });
    mockPrisma.admission.findUnique.mockResolvedValue({
      verification_status: 'apaar_verified',
    });

    await checkDuplicate('123456789012', '2025-26', 'inst-1', 'adm-1');

    expect(mockRedis.lpush).toHaveBeenCalledTimes(2);
  });
});

describe('resolveDuplicate', () => {
  it('resolves pair by rejecting loser', async () => {
    mockPrisma.duplicatePair.findUnique.mockResolvedValue({
      id: 'pair-1',
      status: 'OPEN',
      admission_id_a: 'adm-1',
      admission_id_b: 'adm-2',
    });
    mockPrisma.duplicatePair.update.mockResolvedValue({});
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'duplicate_flagged',
      institution_id: 'inst-1',
    });
    mockPrisma.admission.update.mockResolvedValue({});

    const result = await resolveDuplicate('pair-1', 'adm-1', 'aicte-user-1');
    expect(result.resolved).toBe(true);
  });

  it('returns error for already resolved pair', async () => {
    mockPrisma.duplicatePair.findUnique.mockResolvedValue({
      id: 'pair-1',
      status: 'RESOLVED',
      admission_id_a: 'adm-1',
      admission_id_b: 'adm-2',
    });

    const result = await resolveDuplicate('pair-1', 'adm-1', 'aicte-user-1');
    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Already resolved');
  });

  it('returns error for missing pair', async () => {
    mockPrisma.duplicatePair.findUnique.mockResolvedValue(null);

    const result = await resolveDuplicate('pair-999', 'adm-1', 'aicte-user-1');
    expect(result.resolved).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error when admission not in pair', async () => {
    mockPrisma.duplicatePair.findUnique.mockResolvedValue({
      id: 'pair-1',
      status: 'OPEN',
      admission_id_a: 'adm-1',
      admission_id_b: 'adm-2',
    });

    const result = await resolveDuplicate('pair-1', 'adm-99', 'aicte-user-1');
    expect(result.resolved).toBe(false);
    expect(result.error).toContain('not part of');
  });
});
