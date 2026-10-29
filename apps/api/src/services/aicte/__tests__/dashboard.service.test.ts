import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    institution: { count: vi.fn() },
    admission: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    duplicatePair: { count: vi.fn() },
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  getStats,
  getRegionalBreakdown,
  getStatewiseStats,
  getTrendData,
  getAnomalyAlerts,
  getIntakeViolations,
} from '../dashboard.service.js';

beforeEach(() => vi.clearAllMocks());

describe('getStats', () => {
  it('returns national stats when no region', async () => {
    mockPrisma.institution.count.mockResolvedValue(100);
    mockPrisma.admission.count
      .mockResolvedValueOnce(5000)  // total
      .mockResolvedValueOnce(4000)  // verified
      .mockResolvedValueOnce(200)   // pending
      .mockResolvedValueOnce(50)    // flagged
      .mockResolvedValueOnce(10)    // fraud
      .mockResolvedValueOnce(5);    // intake
    mockPrisma.duplicatePair.count.mockResolvedValue(3);

    const stats = await getStats();
    expect(stats.total_institutions).toBe(100);
    expect(stats.total_students).toBe(5000);
    expect(stats.apaar_coverage_pct).toBe(80);
    expect(stats.duplicate_pairs_open).toBe(3);
  });

  it('returns regional stats when region provided', async () => {
    mockPrisma.institution.count.mockResolvedValue(20);
    mockPrisma.admission.count.mockResolvedValue(0);
    mockPrisma.duplicatePair.count.mockResolvedValue(0);

    const stats = await getStats('NORTHERN');
    expect(stats.total_institutions).toBe(20);
    expect(mockPrisma.institution.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ state: expect.any(Object) }) }),
    );
  });
});

describe('getRegionalBreakdown', () => {
  it('returns breakdown for all regions', async () => {
    mockPrisma.institution.count.mockResolvedValue(10);
    mockPrisma.admission.count.mockResolvedValue(100);
    mockPrisma.duplicatePair.count.mockResolvedValue(0);

    const breakdown = await getRegionalBreakdown();
    expect(breakdown.length).toBeGreaterThan(0);
    expect(breakdown[0]).toHaveProperty('region');
    expect(breakdown[0]).toHaveProperty('total_institutions');
  });
});

describe('getStatewiseStats', () => {
  it('returns per-state stats for valid region', async () => {
    mockPrisma.institution.count.mockResolvedValue(5);
    mockPrisma.admission.count.mockResolvedValue(50);

    const result = await getStatewiseStats('NORTHERN');
    expect(result).toHaveProperty('region', 'NORTHERN');
    expect(result).toHaveProperty('states');
    expect((result as any).states.length).toBeGreaterThan(0);
  });

  it('returns error for invalid region', async () => {
    const result = await getStatewiseStats('INVALID');
    expect(result).toHaveProperty('error', 'Invalid region');
  });
});

describe('getTrendData', () => {
  it('returns enrolment trend data', async () => {
    mockPrisma.admission.groupBy.mockResolvedValue([
      { academic_year: '2024-25', _count: { id: 1000 } },
      { academic_year: '2025-26', _count: { id: 1200 } },
    ]);

    const result = await getTrendData('enrolment', 'yearly');
    expect(result).toHaveProperty('metric', 'enrolment');
    expect((result as any).trends).toHaveLength(2);
    expect((result as any).trends[0].value).toBe(1000);
  });

  it('returns error for invalid metric', async () => {
    const result = await getTrendData('invalid', 'yearly');
    expect(result).toHaveProperty('error');
  });

  it('returns verified trend data', async () => {
    mockPrisma.admission.groupBy.mockResolvedValue([
      { academic_year: '2025-26', _count: { id: 1000 } },
    ]);
    mockPrisma.admission.count.mockResolvedValue(800);

    const result = await getTrendData('verified', 'yearly');
    expect((result as any).trends[0].value).toBe(800);
  });
});

describe('getAnomalyAlerts', () => {
  it('returns anomaly alerts sorted by risk score', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      {
        id: 'adm-1', apaar_id: '123456789012', academic_year: '2025-26',
        verification_status: 'fraud_escalation', anomaly_score: 0.95,
        anomaly_flags: { reason: 'suspicious' }, created_at: new Date(),
        institution: { id: 'inst-1', name: 'Test Inst', state: 'Delhi' },
        student: { name: 'Test Student' },
        programme: { name: 'B.Tech CSE', code: 'BTECH-CSE' },
      },
    ]);

    const alerts = await getAnomalyAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].apaarId).toBe('1234****12');
    expect(alerts[0].anomalyScore).toBe(0.95);
  });
});

describe('getIntakeViolations', () => {
  it('returns intake exceeded records', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      {
        id: 'adm-1', apaar_id: '123456789012', academic_year: '2025-26',
        created_at: new Date(),
        institution: { id: 'inst-1', name: 'Test', state: 'Delhi', approved_intake: {} },
        programme: { name: 'B.Tech', code: 'BTECH', approved_intake: 60 },
      },
    ]);

    const violations = await getIntakeViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0].programme.approvedIntake).toBe(60);
  });
});
