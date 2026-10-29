import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    programme: { findUnique: vi.fn() },
    institution: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({
  redis: { lpush: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../lib/stateMachine.js', () => ({
  canTransition: vi.fn(() => ({ ok: true })),
  transition: vi.fn(),
}));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test' },
}));

import { checkIntake, checkAllIntake } from '../intake.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkIntake', () => {
  it('returns not exceeded when under limit', async () => {
    mockPrisma.programme.findUnique.mockResolvedValue({
      code: 'BTECH-CSE',
      approved_intake: 60,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      approved_intake: { 'BTECH-CSE:2025-26': 60 },
    });
    mockPrisma.admission.count.mockResolvedValue(30);

    const result = await checkIntake('adm-1', 'inst-1', 'prog-1', '2025-26');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(30);
    expect(result.limit).toBe(60);
  });

  it('flags intake exceeded when at limit', async () => {
    mockPrisma.programme.findUnique.mockResolvedValue({
      code: 'BTECH-CSE',
      approved_intake: 60,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      approved_intake: { 'BTECH-CSE:2025-26': 60 },
    });
    mockPrisma.admission.count.mockResolvedValue(60);
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
    });
    mockPrisma.admission.update.mockResolvedValue({});

    const result = await checkIntake('adm-1', 'inst-1', 'prog-1', '2025-26');
    expect(result.exceeded).toBe(true);
  });

  it('falls back to programme approved_intake when no JSONB key', async () => {
    mockPrisma.programme.findUnique.mockResolvedValue({
      code: 'BTECH-CSE',
      approved_intake: 30,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      approved_intake: {},
    });
    mockPrisma.admission.count.mockResolvedValue(30);
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
    });
    mockPrisma.admission.update.mockResolvedValue({});

    const result = await checkIntake('adm-1', 'inst-1', 'prog-1', '2025-26');
    expect(result.exceeded).toBe(true);
    expect(result.limit).toBe(30);
  });

  it('returns not exceeded when programme or institution missing', async () => {
    mockPrisma.programme.findUnique.mockResolvedValue(null);
    mockPrisma.institution.findUnique.mockResolvedValue(null);

    const result = await checkIntake('adm-1', 'inst-1', 'prog-1', '2025-26');
    expect(result.exceeded).toBe(false);
  });
});

describe('checkAllIntake', () => {
  it('checks all APAAR_VERIFIED records in upload', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-1', institution_id: 'inst-1', programme_id: 'prog-1', academic_year: '2025-26' },
      { id: 'adm-2', institution_id: 'inst-1', programme_id: 'prog-1', academic_year: '2025-26' },
    ]);
    mockPrisma.programme.findUnique.mockResolvedValue({
      code: 'BTECH-CSE',
      approved_intake: 100,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      approved_intake: {},
    });
    mockPrisma.admission.count.mockResolvedValue(10);

    const result = await checkAllIntake('upload-1');
    expect(result.checked).toBe(2);
    expect(result.exceeded).toBe(0);
  });
});
