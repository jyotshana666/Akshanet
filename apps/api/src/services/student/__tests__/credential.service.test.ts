import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3 } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', JWT_SECRET: 'test-secret-32-chars-minimum-ok!' },
}));

import { generatePdf, verifyCredential } from '../credential.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/signed-url');
});

describe('generatePdf', () => {
  it('generates credential for STUDENT_VERIFIED admission', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      apaar_id: '123456789012',
      academic_year: '2025-26',
      verification_status: 'student_verified',
      verified_at: new Date('2025-06-15'),
      institution_id: 'inst-1',
      student: { name: 'Test Student' },
      programme: { name: 'B.Tech CSE', code: 'BTECH-CSE' },
      institution: { name: 'IIT Test' },
    });

    const result = await generatePdf('adm-1', 'student-1', '123456789012');
    expect(result).toHaveProperty('url');
    expect(mockS3.putObject).toHaveBeenCalled();
  });

  it('rejects for DRAFT state', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      apaar_id: '123456789012',
      academic_year: '2025-26',
      verification_status: 'draft',
      verified_at: null,
      institution_id: 'inst-1',
      student: { name: 'Test' },
      programme: { name: 'B.Tech', code: 'BTECH' },
      institution: { name: 'IIT' },
    });

    const result = await generatePdf('adm-1', 'student-1', '123456789012');
    expect(result).toHaveProperty('error');
  });

  it('returns error when admission not found', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue(null);
    const result = await generatePdf('adm-999', 'student-1', '123456789012');
    expect(result).toHaveProperty('error');
  });

  it('masks APAAR ID showing first 4 + last 2 only', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      id: 'adm-1',
      apaar_id: '543287654321',
      academic_year: '2025-26',
      verification_status: 'aicte_approved',
      verified_at: new Date(),
      institution_id: 'inst-1',
      student: { name: 'Test' },
      programme: { name: 'B.Tech', code: 'BTECH' },
      institution: { name: 'IIT' },
    });

    const result = await generatePdf('adm-1', 'student-1', '543287654321');
    expect(result).toHaveProperty('url');
    const putCall = mockS3.putObject.mock.calls[0][0];
    const content = putCall.body.toString();
    expect(content).toContain('5432**21');
    expect(content).not.toContain('543287654321');
  });
});

describe('verifyCredential', () => {
  it('returns valid for matching hash', async () => {
    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256')
      .update('123456789012' + 'inst-1' + '2025-26' + 'test-secret-32-chars-minimum-ok!')
      .digest('hex');

    mockPrisma.admission.findMany.mockResolvedValue([
      {
        apaar_id: '123456789012',
        institution_id: 'inst-1',
        academic_year: '2025-26',
        verified_at: new Date('2025-06-15'),
        student: { name: 'Test Student' },
        institution: { name: 'IIT Test' },
        programme: { name: 'B.Tech CSE' },
      },
    ]);

    const result = await verifyCredential(hash);
    expect(result.valid).toBe(true);
    expect(result.name).toBe('Test Student');
  });

  it('returns invalid for non-matching hash', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([]);
    const result = await verifyCredential('invalid-hash');
    expect(result.valid).toBe(false);
  });
});
