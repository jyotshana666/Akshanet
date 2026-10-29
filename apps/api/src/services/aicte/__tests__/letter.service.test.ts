import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3, mockNotificationQueue } = vi.hoisted(() => ({
  mockPrisma: {
    rejectionRecord: { findUnique: vi.fn(), update: vi.fn() },
    approvalRecord: { findUnique: vi.fn() },
    institution: { findUnique: vi.fn() },
    admission: { count: vi.fn() },
    duplicatePair: { count: vi.fn() },
    programme: { findMany: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockNotificationQueue: { add: vi.fn() },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  generateRejectionLetter,
  generateApprovalLetter,
  sendLetter,
} from '../letter.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/letter.pdf');
});

describe('generateRejectionLetter', () => {
  it('generates rejection letter with reason details', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue({
      id: 'rej-1', institution_id: 'inst-1', academic_year: '2025-26',
      rejected_by: 'officer-1', rejected_at: new Date('2025-07-01'),
      reason_codes: ['APAAR_COVERAGE_LOW', 'INTAKE_EXCEEDED'], custom_note: 'Please fix',
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      name: 'IIT Test', state: 'Delhi', district: 'South Delhi', aicte_id: 'AICTE-001',
    });
    mockPrisma.admission.count
      .mockResolvedValueOnce(100)  // total for APAAR_COVERAGE_LOW
      .mockResolvedValueOnce(80)   // verified for APAAR_COVERAGE_LOW
      .mockResolvedValueOnce(5);   // intake exceeded count
    mockPrisma.rejectionRecord.update.mockResolvedValue({});

    const result = await generateRejectionLetter('rej-1');
    expect(result).toHaveProperty('url');
    expect(mockS3.putObject).toHaveBeenCalled();
    const htmlContent = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(htmlContent).toContain('IIT Test');
    expect(htmlContent).toContain('2025-26');
    expect(htmlContent).toContain('Please fix');
  });

  it('returns error for missing rejection record', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue(null);
    const result = await generateRejectionLetter('rej-999');
    expect(result).toHaveProperty('error', 'Rejection record not found');
  });

  it('does not expose raw APAAR IDs in letter', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue({
      id: 'rej-1', institution_id: 'inst-1', academic_year: '2025-26',
      rejected_by: 'officer-1', rejected_at: new Date(),
      reason_codes: ['APAAR_COVERAGE_LOW'], custom_note: null,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      name: 'Test', state: 'Delhi', district: 'Central', aicte_id: 'A-001',
    });
    mockPrisma.admission.count.mockResolvedValue(10);
    mockPrisma.rejectionRecord.update.mockResolvedValue({});

    const result = await generateRejectionLetter('rej-1');
    expect(result).toHaveProperty('url');
    const content = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(content).not.toMatch(/\d{12}/);
  });
});

describe('generateApprovalLetter', () => {
  it('generates approval letter', async () => {
    mockPrisma.approvalRecord.findUnique.mockResolvedValue({
      id: 'apr-1', institution_id: 'inst-1', academic_year: '2025-26',
      approved_by: 'officer-1', approved_at: new Date(), record_count: 50,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      name: 'IIT', state: 'Delhi', district: 'South', aicte_id: 'AICTE-001',
    });
    mockPrisma.programme.findMany.mockResolvedValue([
      { name: 'B.Tech CSE', code: 'BTECH-CSE', approved_intake: 120 },
    ]);

    const result = await generateApprovalLetter('apr-1');
    expect(result).toHaveProperty('url');
    const content = mockS3.putObject.mock.calls[0][0].body.toString();
    expect(content).toContain('approved');
    expect(content).toContain('B.Tech CSE');
  });

  it('returns error for missing approval record', async () => {
    mockPrisma.approvalRecord.findUnique.mockResolvedValue(null);
    const result = await generateApprovalLetter('apr-999');
    expect(result).toHaveProperty('error', 'Approval record not found');
  });
});

describe('sendLetter', () => {
  it('sends rejection letter to recipients', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue({ letter_s3_key: 'letters/test.pdf' });
    mockPrisma.rejectionRecord.update.mockResolvedValue({});

    const result = await sendLetter('rej-1', 'rejection', ['admin@inst.edu', 'regional@aicte.gov.in']);
    expect(result.sent).toBe(true);
    expect(mockNotificationQueue.add).toHaveBeenCalledTimes(2);
  });

  it('fails when letter not generated', async () => {
    mockPrisma.rejectionRecord.findUnique.mockResolvedValue({ letter_s3_key: null });
    const result = await sendLetter('rej-1', 'rejection', ['admin@inst.edu']);
    expect(result.sent).toBe(false);
    expect(result.error).toContain('not generated');
  });

  it('sends approval letter', async () => {
    mockPrisma.approvalRecord.findUnique.mockResolvedValue({
      id: 'apr-1', institution_id: 'inst-1', academic_year: '2025-26',
      approved_by: 'officer-1', approved_at: new Date(), record_count: 50,
    });
    mockPrisma.institution.findUnique.mockResolvedValue({
      name: 'IIT', state: 'Delhi', district: 'South', aicte_id: 'AICTE-001',
    });
    mockPrisma.programme.findMany.mockResolvedValue([]);

    const result = await sendLetter('apr-1', 'approval', ['admin@inst.edu']);
    expect(result.sent).toBe(true);
  });
});
