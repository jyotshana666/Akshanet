import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3, mockAudit, mockStateMachine, mockNotificationQueue } = vi.hoisted(() => ({
  mockPrisma: {
    student: { findFirst: vi.fn() },
    admission: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    accessLog: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockStateMachine: { transition: vi.fn(), canTransition: vi.fn() },
  mockNotificationQueue: { add: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../lib/audit.js', () => mockAudit);
vi.mock('../../lib/stateMachine.js', () => mockStateMachine);
vi.mock('../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../config.js', () => ({
  config: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-32-chars-minimum-ok!' },
}));

import { getProfile } from '../../services/student/profile.service.js';
import { verifyRecord } from '../../services/student/verification.service.js';
import { generatePdf } from '../../services/student/credential.service.js';
import { getAccessLog } from '../../services/student/accessLog.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/credential.pdf');
});

describe('E2E: Student Verification Flow', () => {
  it('step 1: student gets profile with pre-filled data', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      apaar_id: '543210987654',
      academic_year: '2024-25',
      verification_status: 'aicte_approved',
      apaar_validated_at: new Date('2024-09-01'),
      apaar_risk_score: null,
      student: { name: 'Riya Krishnamoorthy' },
      programme: { name: 'B.Tech CSE', code: 'B.Tech-CSE' },
      institution: { name: 'Saveetha Engineering College' },
      _count: { flags: 0 },
    });

    const profile = await getProfile('543210987654');
    expect(profile).not.toHaveProperty('error');
  });

  it('step 2: student verifies record → STUDENT_VERIFIED', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      verification_status: 'apaar_verified',
      institution_id: 'inst-1',
      student: { name: 'Riya Krishnamoorthy' },
    });
    mockStateMachine.transition.mockResolvedValue(undefined);
    mockPrisma.admission.update.mockResolvedValue({});

    const result = await verifyRecord('adm-1', 'student-riya', '543210987654');
    expect(result.verified).toBe(true);
    expect(mockStateMachine.transition).toHaveBeenCalledWith(
      expect.anything(),
      'adm-1',
      'student_verified',
      'student-riya',
      'STUDENT',
    );
  });

  it('step 3: student downloads PDF credential with masked APAAR', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      apaar_id: '543210987654',
      academic_year: '2024-25',
      verification_status: 'student_verified',
      verified_at: new Date('2024-10-01'),
      institution_id: 'inst-1',
      student: { name: 'Riya Krishnamoorthy' },
      programme: { name: 'B.Tech CSE', code: 'B.Tech-CSE' },
      institution: { name: 'Saveetha Engineering College' },
    });

    const result = await generatePdf('adm-1', 'student-riya', '543210987654');
    expect(result).toHaveProperty('url');
    expect(mockS3.putObject).toHaveBeenCalled();

    const content = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(content).toContain('5432**54');
    expect(content).not.toContain('543210987654');
  });

  it('step 4: access log empty before employer access', async () => {
    mockPrisma.accessLog.findMany.mockResolvedValue([]);
    mockPrisma.accessLog.count.mockResolvedValue(0);

    const result = await getAccessLog('student-riya', 1, 20);
    expect(result.logs).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
