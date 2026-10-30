import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockS3, mockAudit, mockNotificationQueue } = vi.hoisted(() => ({
  mockPrisma: {
    employer: { findUnique: vi.fn(), findFirst: vi.fn() },
    student: { findFirst: vi.fn() },
    employerBlock: { findUnique: vi.fn() },
    consentRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    consent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    admission: { findFirst: vi.fn() },
    accessLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockNotificationQueue: { add: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../lib/audit.js', () => mockAudit);
vi.mock('../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../config.js', () => ({
  config: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-32-chars-minimum-ok!' },
}));

import { requestConsent, approveConsentByToken } from '../../services/employer/consentRequest.service.js';
import { getVerifiedRecord, generateVerificationCertificate } from '../../services/employer/verification.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/cert.pdf');
});

describe('E2E: Employer Verification Flow', () => {
  it('step 1: TCS requests consent for Riya', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({
      id: 'emp-tcs', status: 'APPROVED', company_name: 'TCS',
    });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-riya' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.consentRequest.findFirst.mockResolvedValue(null);
    mockPrisma.consentRequest.create.mockResolvedValue({ id: 'req-1' });
    mockRedis.set.mockResolvedValue('OK');

    const result = await requestConsent('emp-tcs', '543210987654', 'Employment verification');
    expect(result).toHaveProperty('requestId', 'req-1');
    expect(mockNotificationQueue.add).toHaveBeenCalled();
  });

  it('step 2: student approves consent via token', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-riya', employer_id: 'emp-tcs',
      status: 'PENDING', expires_at: new Date(Date.now() + 86400000),
      apaar_id: '543210987654',
    });
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockPrisma.consentRequest.update.mockResolvedValue({});
    mockPrisma.consent.create.mockResolvedValue({});

    const result = await approveConsentByToken('riya-token', 'student-riya');
    expect(result.approved).toBe(true);
  });

  it('step 3: TCS fetches verified record — limited fields only, no raw APAAR/mobile/email', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({
      id: 'emp-tcs', status: 'APPROVED', user_id: 'tcs-user',
    });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-riya' });
    mockPrisma.consent.findFirst.mockResolvedValue({
      id: 'consent-1', expires_at: new Date(Date.now() + 86400000),
    });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.admission.findFirst.mockResolvedValue({
      academic_year: '2024-25',
      verification_status: 'aicte_approved',
      verified_at: new Date('2024-11-01'),
      student: { name: 'Riya Krishnamoorthy' },
      programme: { name: 'B.Tech CSE' },
      institution: { name: 'Saveetha Engineering College' },
    });
    mockPrisma.accessLog.create.mockResolvedValue({});

    const result = await getVerifiedRecord('emp-tcs', '543210987654');
    expect(result).toHaveProperty('record');
    const { record } = result as { record: any };

    expect(record.name).toBe('Riya Krishnamoorthy');
    expect(record.programme).toBe('B.Tech CSE');
    expect(record.institutionName).toBe('Saveetha Engineering College');
    expect(record.verificationStatus).toBe('aicte_approved');

    const recordStr = JSON.stringify(record);
    expect(recordStr).not.toContain('543210987654');
    expect(recordStr).not.toContain('mobile');
    expect(recordStr).not.toContain('email');
    expect(recordStr).not.toContain('address');
    expect(recordStr).not.toContain('caste');
    expect(recordStr).not.toContain('religion');
    expect(recordStr).not.toContain('aadhaar');
  });

  it('step 4: TCS generates verification certificate — masked APAAR', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({
      id: 'emp-tcs', status: 'APPROVED', user_id: 'tcs-user',
    });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-riya' });
    mockPrisma.consent.findFirst.mockResolvedValue({
      id: 'consent-1', expires_at: new Date(Date.now() + 86400000),
    });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.admission.findFirst.mockResolvedValue({
      academic_year: '2024-25',
      verification_status: 'aicte_approved',
      verified_at: new Date('2024-11-01'),
      student: { name: 'Riya Krishnamoorthy' },
      programme: { name: 'B.Tech CSE' },
      institution: { name: 'Saveetha Engineering College' },
    });
    mockPrisma.accessLog.create.mockResolvedValue({});

    const result = await generateVerificationCertificate('emp-tcs', '543210987654');
    expect(result).toHaveProperty('url');

    const content = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(content).toContain('5432**54');
    expect(content).not.toContain('543210987654');
  });
});
