import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3, mockAudit, mockTransition, mockNotificationQueue } = vi.hoisted(() => ({
  mockPrisma: {
    institution: { findMany: vi.fn(), findUnique: vi.fn() },
    admission: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    duplicatePair: { count: vi.fn() },
    programme: { findMany: vi.fn() },
    approvalRecord: { create: vi.fn() },
    rejectionRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockTransition: vi.fn(),
  mockNotificationQueue: { add: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../lib/audit.js', () => mockAudit);
vi.mock('../../lib/stateMachine.js', () => ({ transition: mockTransition }));
vi.mock('../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import { getApprovalQueue, getInstitutionDetail, approveInstitution, rejectInstitution } from '../../services/aicte/approval.service.js';
import { generateRejectionLetter } from '../../services/aicte/letter.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/letter.pdf');
});

describe('E2E: AICTE Approval Flow', () => {
  it('step 1: AICTE officer sees approval queue with Saveetha + IITB', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-saveetha', name: 'Saveetha Engineering College', state: 'Tamil Nadu', aicte_id: 'SEC-TN-2019-001' },
      { id: 'inst-iitb', name: 'IIT Bombay', state: 'Maharashtra', aicte_id: 'IITB-MH-2001-001' },
    ]);

    // Saveetha: has submitted records
    mockPrisma.admission.count
      .mockResolvedValueOnce(3)   // saveetha submitted
      .mockResolvedValueOnce(8)   // saveetha total
      .mockResolvedValueOnce(5)   // saveetha verified
      .mockResolvedValueOnce(1)   // saveetha flagged
      .mockResolvedValueOnce(0)   // saveetha fraud
      .mockResolvedValueOnce(0)   // saveetha intake
      .mockResolvedValueOnce(1)   // iitb submitted
      .mockResolvedValueOnce(2)   // iitb total
      .mockResolvedValueOnce(2)   // iitb verified
      .mockResolvedValueOnce(0)   // iitb flagged
      .mockResolvedValueOnce(0)   // iitb fraud
      .mockResolvedValueOnce(0);  // iitb intake

    mockPrisma.admission.findFirst
      .mockResolvedValueOnce({ submitted_at: new Date('2024-09-15') }) // saveetha
      .mockResolvedValueOnce({ submitted_at: new Date('2024-09-10') }); // iitb

    const result = await getApprovalQueue(null, {}, 1, 20);
    expect(result.institutions).toHaveLength(2);
    // IIT Bombay first (older submission date)
    expect(result.institutions[0].name).toBe('IIT Bombay');
  });

  it('step 2: Saveetha institution detail shows APH checklist issues', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-saveetha', name: 'Saveetha', state: 'Tamil Nadu', district: 'Chennai',
      type: 'Engineering', aicte_id: 'SEC-TN-2019-001', approved_intake: {}, is_active: true,
    });

    mockPrisma.admission.count
      .mockResolvedValueOnce(8)   // total
      .mockResolvedValueOnce(5)   // verified
      .mockResolvedValueOnce(3)   // unverified submitted
      .mockResolvedValueOnce(1)   // flagged
      .mockResolvedValueOnce(0)   // fraud (from Saveetha — PSG has the fraud)
      .mockResolvedValueOnce(0);  // intake
    mockPrisma.duplicatePair.count.mockResolvedValue(1); // open dup pair
    mockPrisma.admission.groupBy.mockResolvedValue([
      { verification_status: 'aicte_approved', _count: { id: 2 } },
      { verification_status: 'student_verified', _count: { id: 1 } },
      { verification_status: 'duplicate_flagged', _count: { id: 1 } },
    ]);
    mockPrisma.programme.findMany.mockResolvedValue([]);

    const detail = await getInstitutionDetail('inst-saveetha');
    expect(detail).toHaveProperty('checklist');
    const checklist = (detail as any).checklist;

    // Should show issues
    expect(checklist.apaarCoverage100).toBe(false);     // 5/8 ≠ 100%
    expect(checklist.noDuplicates).toBe(false);          // 1 open dup
    expect(checklist.allStudentsVerified).toBe(false);   // unverified submitted > 0
  });

  it('step 3: reject Saveetha with reason codes → rejection record created', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-saveetha', state: 'Tamil Nadu', name: 'Saveetha',
    });
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-priya' },
      { id: 'adm-karthik' },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockTransition.mockResolvedValue(undefined);
    mockPrisma.rejectionRecord.create.mockResolvedValue({ id: 'rej-saveetha-1' });

    const result = await rejectInstitution(
      'inst-saveetha',
      'officer-southern',
      '2024-25',
      ['DUPLICATE_UNRESOLVED', 'STUDENT_VERIFICATION_INCOMPLETE'],
      'Multiple compliance issues found',
      null,
    );

    expect(result.rejected).toBe(true);
    expect(result.rejectionId).toBe('rej-saveetha-1');
    expect(mockTransition).toHaveBeenCalledTimes(2);
    expect(mockNotificationQueue.add).toHaveBeenCalled();
  });

  it('step 4: generate rejection letter → S3 key set', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue({
      id: 'rej-saveetha-1', institution_id: 'inst-saveetha', academic_year: '2024-25',
      rejected_by: 'officer-southern', rejected_at: new Date('2024-12-01'),
      reason_codes: ['DUPLICATE_UNRESOLVED', 'STUDENT_VERIFICATION_INCOMPLETE'],
      custom_note: 'Multiple compliance issues found',
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      name: 'Saveetha Engineering College', state: 'Tamil Nadu',
      district: 'Chennai', aicte_id: 'SEC-TN-2019-001',
    });
    mockPrisma.duplicatePair.count.mockResolvedValue(1);
    mockPrisma.admission.count
      .mockResolvedValueOnce(8)   // total for STUDENT_VERIFICATION_INCOMPLETE
      .mockResolvedValueOnce(5);  // not in verified states

    mockPrisma.rejectionRecord.update.mockResolvedValue({});

    const result = await generateRejectionLetter('rej-saveetha-1');
    expect(result).toHaveProperty('url');

    // Verify letter content
    const html = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(html).toContain('Saveetha Engineering College');
    expect(html).toContain('2024-25');
    expect(html).toContain('rejected');
    expect(html).toContain('30 days');
    // S3 key was set
    expect(mockPrisma.rejectionRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ letter_s3_key: expect.stringContaining('letters/') }),
      }),
    );
  });

  it('step 5: approve IIT Bombay (clean record)', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-iitb', state: 'Maharashtra', name: 'IIT Bombay',
    });
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-rahul', verification_status: 'submitted_to_aicte' },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockTransition.mockResolvedValue(undefined);
    mockPrisma.approvalRecord.create.mockResolvedValue({ id: 'apr-iitb-1' });

    const result = await approveInstitution('inst-iitb', 'officer-national', '2024-25', null);
    expect(result.approved).toBe(true);
    expect(result.recordCount).toBe(1);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      'adm-rahul',
      'aicte_approved',
      'officer-national',
      'AICTE_ADMIN',
    );
  });
});
