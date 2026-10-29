import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockAudit, mockNotificationQueue, mockTransition } = vi.hoisted(() => ({
  mockPrisma: {
    institution: { findMany: vi.fn(), findUnique: vi.fn() },
    admission: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    duplicatePair: { count: vi.fn() },
    programme: { findMany: vi.fn() },
    approvalRecord: { create: vi.fn() },
    rejectionRecord: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockNotificationQueue: { add: vi.fn() },
  mockTransition: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/audit.js', () => mockAudit);
vi.mock('../../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../../lib/stateMachine.js', () => ({ transition: mockTransition }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  getApprovalQueue,
  getInstitutionDetail,
  approveInstitution,
  rejectInstitution,
} from '../approval.service.js';

beforeEach(() => vi.clearAllMocks());

describe('getApprovalQueue', () => {
  it('returns institutions with submitted records', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'Test Inst', state: 'Delhi', aicte_id: 'AICTE-001' },
    ]);
    mockPrisma.admission.count
      .mockResolvedValueOnce(10) // submittedCount
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(40) // verified
      .mockResolvedValueOnce(2)  // flagged
      .mockResolvedValueOnce(1)  // fraud
      .mockResolvedValueOnce(0); // intake
    mockPrisma.admission.findFirst.mockResolvedValue({ submitted_at: new Date('2025-06-01') });

    const result = await getApprovalQueue(null, {}, 1, 20);
    expect(result.institutions).toHaveLength(1);
    expect(result.institutions[0].submittedCount).toBe(10);
  });

  it('filters out institutions with zero submitted records', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'Empty', state: 'Delhi', aicte_id: 'AICTE-001' },
    ]);
    mockPrisma.admission.count.mockResolvedValue(0);

    const result = await getApprovalQueue(null, {}, 1, 20);
    expect(result.institutions).toHaveLength(0);
  });
});

describe('getInstitutionDetail', () => {
  it('returns full detail with checklist', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-1', name: 'IIT', state: 'Delhi', district: 'South',
      type: 'Engineering', aicte_id: 'AICTE-001', approved_intake: {}, is_active: true,
    });
    mockPrisma.admission.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(100) // verified
      .mockResolvedValueOnce(0)   // unverifiedSubmitted
      .mockResolvedValueOnce(0)   // flagged
      .mockResolvedValueOnce(0)   // fraud
      .mockResolvedValueOnce(0);  // intake
    mockPrisma.duplicatePair.count.mockResolvedValue(0);
    mockPrisma.admission.groupBy.mockResolvedValue([
      { verification_status: 'aicte_approved', _count: { id: 100 } },
    ]);
    mockPrisma.programme.findMany.mockResolvedValue([]);

    const result = await getInstitutionDetail('inst-1');
    expect(result).toHaveProperty('checklist');
    expect((result as any).checklist.apaarCoverage100).toBe(true);
    expect((result as any).checklist.noFraudEscalations).toBe(true);
  });

  it('returns error for missing institution', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue(null);
    const result = await getInstitutionDetail('inst-999');
    expect(result).toHaveProperty('error', 'Institution not found');
  });
});

describe('approveInstitution', () => {
  it('approves all submitted records', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Delhi', name: 'IIT' });
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-1', verification_status: 'submitted_to_aicte' },
      { id: 'adm-2', verification_status: 'submitted_to_aicte' },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockTransition.mockResolvedValue(undefined);
    mockPrisma.approvalRecord.create.mockResolvedValue({ id: 'apr-1' });

    const result = await approveInstitution('inst-1', 'officer-1', '2025-26', null);
    expect(result.approved).toBe(true);
    expect(result.recordCount).toBe(2);
    expect(mockTransition).toHaveBeenCalledTimes(2);
  });

  it('rejects when no records found', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Delhi', name: 'IIT' });
    mockPrisma.admission.findMany.mockResolvedValue([]);

    const result = await approveInstitution('inst-1', 'officer-1', '2025-26', null);
    expect(result.approved).toBe(false);
    expect(result.error).toContain('No submitted records');
  });

  it('enforces region check for regional officer', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Tamil Nadu', name: 'IIT' });

    const result = await approveInstitution('inst-1', 'officer-1', '2025-26', 'NORTHERN');
    expect(result.approved).toBe(false);
    expect(result.error).toContain('not in your region');
  });
});

describe('rejectInstitution', () => {
  it('rejects with valid reason codes', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Delhi', name: 'IIT' });
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-1' },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockTransition.mockResolvedValue(undefined);
    mockPrisma.rejectionRecord.create.mockResolvedValue({ id: 'rej-1' });

    const result = await rejectInstitution('inst-1', 'officer-1', '2025-26', ['APAAR_COVERAGE_LOW'], undefined, null);
    expect(result.rejected).toBe(true);
    expect(result.rejectionId).toBe('rej-1');
  });

  it('rejects invalid reason codes', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Delhi', name: 'IIT' });

    const result = await rejectInstitution('inst-1', 'officer-1', '2025-26', ['INVALID_CODE'], undefined, null);
    expect(result.rejected).toBe(false);
    expect(result.error).toContain('Invalid reason codes');
  });

  it('enforces region check for regional officer', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1', state: 'Kerala', name: 'IIT' });

    const result = await rejectInstitution('inst-1', 'officer-1', '2025-26', ['APAAR_COVERAGE_LOW'], undefined, 'NORTHERN');
    expect(result.rejected).toBe(false);
    expect(result.error).toContain('not in your region');
  });
});
