import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockScoreBatch, mockTransition, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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
  mockScoreBatch: vi.fn(),
  mockTransition: vi.fn(),
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/mlClient.js', () => ({ scoreBatch: mockScoreBatch }));
vi.mock('../../../lib/stateMachine.js', () => ({
  canTransition: vi.fn(() => ({ ok: true })),
  transition: mockTransition,
}));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', ML_SERVICE_URL: 'http://localhost:8000' },
}));

import { scoreUpload, updateRiskScores } from '../scoring.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.admission.update.mockResolvedValue({});
  mockRedis.lpush.mockResolvedValue(1);
  mockTransition.mockResolvedValue(undefined);
});

describe('scoreUpload', () => {
  it('scores all APAAR_VERIFIED records in upload', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      {
        id: 'adm-1',
        apaar_id: '123456789012',
        institution_id: 'inst-1',
        academic_year: '2025-26',
        created_at: new Date('2025-06-15'),
        programme: { code: 'BTECH-CSE' },
        upload: { created_at: new Date('2025-06-15') },
      },
    ]);
    mockScoreBatch.mockResolvedValue([
      { admission_id: 'adm-1', risk_score: 0.1, flag: 'CLEAN' },
    ]);

    const result = await scoreUpload('upload-1');
    expect(result.scored).toBe(1);
    expect(result.clean).toBe(1);
    expect(result.escalated).toBe(0);
    expect(result.watched).toBe(0);
  });

  it('returns zeros for empty upload', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([]);

    const result = await scoreUpload('upload-1');
    expect(result.scored).toBe(0);
  });
});

describe('updateRiskScores', () => {
  it('transitions FRAUD_ESCALATION records', async () => {
    const result = await updateRiskScores([
      { admission_id: 'adm-1', risk_score: 0.85, flag: 'FRAUD_ESCALATION' },
    ]);

    expect(result.escalated).toBe(1);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(), 'adm-1', 'fraud_escalation',
      'system:ml-scorer', 'SYSTEM',
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS_CHANGE',
        admissionId: 'adm-1',
      }),
    );
  });

  it('transitions ANOMALY_WATCH records', async () => {
    const result = await updateRiskScores([
      { admission_id: 'adm-2', risk_score: 0.55, flag: 'ANOMALY_WATCH' },
    ]);

    expect(result.watched).toBe(1);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(), 'adm-2', 'anomaly_watch',
      'system:ml-scorer', 'SYSTEM',
    );
  });

  it('does not transition CLEAN records', async () => {
    const result = await updateRiskScores([
      { admission_id: 'adm-3', risk_score: 0.15, flag: 'CLEAN' },
    ]);

    expect(result.clean).toBe(1);
    expect(mockTransition).not.toHaveBeenCalled();
    expect(mockPrisma.admission.update).toHaveBeenCalledWith({
      where: { id: 'adm-3' },
      data: { apaar_risk_score: 0.15 },
    });
  });

  it('sends notification for FRAUD_ESCALATION', async () => {
    await updateRiskScores([
      { admission_id: 'adm-1', risk_score: 0.9, flag: 'FRAUD_ESCALATION' },
    ]);

    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'queue:notification',
      expect.stringContaining('fraud_escalation'),
    );
  });

  it('handles mixed flags in batch', async () => {
    const result = await updateRiskScores([
      { admission_id: 'a1', risk_score: 0.9, flag: 'FRAUD_ESCALATION' },
      { admission_id: 'a2', risk_score: 0.5, flag: 'ANOMALY_WATCH' },
      { admission_id: 'a3', risk_score: 0.1, flag: 'CLEAN' },
    ]);

    expect(result.scored).toBe(3);
    expect(result.escalated).toBe(1);
    expect(result.watched).toBe(1);
    expect(result.clean).toBe(1);
  });
});
