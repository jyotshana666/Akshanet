import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3, mockAudit, mockCheckConsent, mockLogAccess } = vi.hoisted(() => ({
  mockPrisma: {
    employer: { findUnique: vi.fn() },
    student: { findFirst: vi.fn() },
    employerBlock: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    admission: { findFirst: vi.fn() },
    consent: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    consentRequest: { updateMany: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockCheckConsent: vi.fn(),
  mockLogAccess: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../../lib/audit.js', () => mockAudit);
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-32-chars-minimum-ok!' },
}));
vi.mock('../../student/consent.service.js', () => ({ checkConsent: mockCheckConsent }));
vi.mock('../../student/accessLog.service.js', () => ({ logAccess: mockLogAccess }));

import {
  getVerifiedRecord,
  generateVerificationCertificate,
  blockEmployer,
} from '../verification.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/signed-url');
  mockLogAccess.mockResolvedValue(undefined);
});

describe('getVerifiedRecord', () => {
  it('returns record with consent', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(true);
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.admission.findFirst.mockResolvedValue({
      academic_year: '2025-26',
      verification_status: 'student_verified',
      verified_at: new Date('2025-06-15'),
      student: { name: 'Test Student' },
      programme: { name: 'B.Tech CSE' },
      institution: { name: 'IIT Test' },
    });

    const result = await getVerifiedRecord('emp-1', '123456789012');
    expect(result).toHaveProperty('record');
    const { record } = result as { record: any };
    expect(record.name).toBe('Test Student');
    expect(record.programme).toBe('B.Tech CSE');
    expect(mockLogAccess).toHaveBeenCalled();
  });

  it('rejects without consent', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(false);

    const result = await getVerifiedRecord('emp-1', '123456789012');
    expect(result).toHaveProperty('error', 'No active consent from student');
  });

  it('rejects unapproved employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'PENDING', user_id: 'user-1' });

    const result = await getVerifiedRecord('emp-1', '123456789012');
    expect(result).toHaveProperty('error', 'Employer not approved');
  });

  it('rejects when blocked by student', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(true);
    mockPrisma.employerBlock.findUnique.mockResolvedValue({ id: 'block-1' });

    const result = await getVerifiedRecord('emp-1', '123456789012');
    expect(result).toHaveProperty('error', 'Access blocked by student');
  });

  it('does not expose raw APAAR ID, mobile, email, or address', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(true);
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.admission.findFirst.mockResolvedValue({
      academic_year: '2025-26',
      verification_status: 'aicte_approved',
      verified_at: new Date(),
      student: { name: 'Test' },
      programme: { name: 'MBA' },
      institution: { name: 'IIM' },
    });

    const result = await getVerifiedRecord('emp-1', '543287654321');
    expect(result).toHaveProperty('record');
    const { record } = result as { record: any };
    const recordStr = JSON.stringify(record);
    expect(recordStr).not.toContain('543287654321');
    expect(recordStr).not.toContain('mobile');
    expect(recordStr).not.toContain('email');
    expect(recordStr).not.toContain('address');
    expect(recordStr).not.toContain('caste');
    expect(recordStr).not.toContain('religion');
  });
});

describe('generateVerificationCertificate', () => {
  it('generates certificate for consented record', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(true);
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.admission.findFirst.mockResolvedValue({
      academic_year: '2025-26',
      verification_status: 'student_verified',
      verified_at: new Date(),
      student: { name: 'Test' },
      programme: { name: 'B.Tech' },
      institution: { name: 'IIT' },
    });

    const result = await generateVerificationCertificate('emp-1', '123456789012');
    expect(result).toHaveProperty('url');
    const putCall = mockS3.putObject.mock.calls[0][0];
    const content = putCall.body.toString();
    expect(content).toContain('1234**12');
    expect(content).not.toContain('123456789012');
  });

  it('fails without consent', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockCheckConsent.mockResolvedValue(false);

    const result = await generateVerificationCertificate('emp-1', '123456789012');
    expect(result).toHaveProperty('error');
  });
});

describe('blockEmployer', () => {
  it('blocks employer and revokes consent', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockPrisma.employerBlock.create.mockResolvedValue({});
    mockPrisma.consent.findFirst.mockResolvedValue({ id: 'consent-1' });
    mockPrisma.consent.update.mockResolvedValue({});
    mockPrisma.consentRequest.updateMany.mockResolvedValue({ count: 1 });

    const result = await blockEmployer('student-1', 'emp-1', 'Spam');
    expect(result.blocked).toBe(true);
    expect(mockPrisma.consent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REVOKED' }) }),
    );
  });

  it('is idempotent for already blocked', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue({ id: 'block-1' });

    const result = await blockEmployer('student-1', 'emp-1');
    expect(result.blocked).toBe(true);
    expect(mockPrisma.employerBlock.create).not.toHaveBeenCalled();
  });

  it('returns error for non-existent employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue(null);

    const result = await blockEmployer('student-1', 'emp-999');
    expect(result.blocked).toBe(false);
    expect(result.error).toBe('Employer not found');
  });
});
