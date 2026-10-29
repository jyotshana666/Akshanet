import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockAudit, mockNotificationQueue } = vi.hoisted(() => ({
  mockPrisma: {
    employer: { findUnique: vi.fn() },
    student: { findFirst: vi.fn() },
    employerBlock: { findUnique: vi.fn() },
    consentRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    consent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
  mockNotificationQueue: { add: vi.fn() },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => mockAudit);
vi.mock('../../../lib/queues.js', () => ({ notificationQueue: mockNotificationQueue }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  requestConsent,
  approveConsentByToken,
  denyConsentByToken,
  getPendingRequests,
  getRequestHistory,
  expireOutdatedRequests,
} from '../consentRequest.service.js';

beforeEach(() => vi.clearAllMocks());

describe('requestConsent', () => {
  it('creates consent request successfully', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', company_name: 'Corp' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.consentRequest.findFirst.mockResolvedValue(null);
    mockPrisma.consentRequest.create.mockResolvedValue({ id: 'req-1' });
    mockRedis.set.mockResolvedValue('OK');

    const result = await requestConsent('emp-1', '123456789012', 'Employment verification');
    expect(result).toHaveProperty('requestId', 'req-1');
    expect(mockNotificationQueue.add).toHaveBeenCalled();
  });

  it('rejects unapproved employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'PENDING', company_name: 'Corp' });

    const result = await requestConsent('emp-1', '123456789012', 'Test');
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('not approved');
  });

  it('rejects when student not found', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', company_name: 'Corp' });
    mockPrisma.student.findFirst.mockResolvedValue(null);

    const result = await requestConsent('emp-1', '999999999999', 'Test');
    expect(result).toHaveProperty('error', 'Student not found for given APAAR ID');
  });

  it('rejects when blocked by student', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', company_name: 'Corp' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue({ id: 'block-1' });

    const result = await requestConsent('emp-1', '123456789012', 'Test');
    expect(result).toHaveProperty('error', 'You have been blocked by this student');
  });

  it('enforces rate limit', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', company_name: 'Corp' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue('5');

    const result = await requestConsent('emp-1', '123456789012', 'Test');
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('limit reached');
  });

  it('rejects duplicate pending request', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', company_name: 'Corp' });
    mockPrisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    mockPrisma.employerBlock.findUnique.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.consentRequest.findFirst.mockResolvedValue({ id: 'req-existing' });

    const result = await requestConsent('emp-1', '123456789012', 'Test');
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('pending request already exists');
  });
});

describe('approveConsentByToken', () => {
  it('approves valid request', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-1', employer_id: 'emp-1',
      status: 'PENDING', expires_at: new Date(Date.now() + 86400000), apaar_id: '123456789012',
    });
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockPrisma.consentRequest.update.mockResolvedValue({});
    mockPrisma.consent.create.mockResolvedValue({});

    const result = await approveConsentByToken('valid-token', 'student-1');
    expect(result.approved).toBe(true);
  });

  it('rejects expired request', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-1', employer_id: 'emp-1',
      status: 'PENDING', expires_at: new Date(Date.now() - 1000), apaar_id: '123456789012',
    });
    mockPrisma.consentRequest.update.mockResolvedValue({});

    const result = await approveConsentByToken('expired-token', 'student-1');
    expect(result.approved).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('rejects wrong student', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-2', employer_id: 'emp-1',
      status: 'PENDING', expires_at: new Date(Date.now() + 86400000), apaar_id: '123456789012',
    });

    const result = await approveConsentByToken('token', 'student-1');
    expect(result.approved).toBe(false);
    expect(result.error).toContain('does not belong');
  });
});

describe('denyConsentByToken', () => {
  it('denies valid pending request', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-1', status: 'PENDING', expires_at: new Date(Date.now() + 86400000),
    });
    mockPrisma.consentRequest.update.mockResolvedValue({});

    const result = await denyConsentByToken('valid-token', 'student-1');
    expect(result.denied).toBe(true);
  });

  it('rejects already responded request', async () => {
    mockPrisma.consentRequest.findUnique.mockResolvedValue({
      id: 'req-1', student_id: 'student-1', status: 'APPROVED', expires_at: new Date(Date.now() + 86400000),
    });

    const result = await denyConsentByToken('token', 'student-1');
    expect(result.denied).toBe(false);
  });
});

describe('getPendingRequests', () => {
  it('returns pending requests for student', async () => {
    mockPrisma.consentRequest.findMany.mockResolvedValue([
      {
        id: 'req-1', purpose: 'Hire', token: 'tok-1',
        expires_at: new Date('2026-12-31'), created_at: new Date('2026-10-01'),
        employer: { company_name: 'Corp A' },
      },
    ]);

    const result = await getPendingRequests('student-1');
    expect(result).toHaveLength(1);
    expect(result[0].employerName).toBe('Corp A');
  });
});

describe('getRequestHistory', () => {
  it('returns paginated history for employer', async () => {
    mockPrisma.consentRequest.findMany.mockResolvedValue([
      {
        id: 'req-1', apaar_id: '123456789012', purpose: 'Hire',
        status: 'APPROVED', created_at: new Date(), responded_at: new Date(),
      },
    ]);
    mockPrisma.consentRequest.count.mockResolvedValue(1);

    const result = await getRequestHistory('emp-1', 1, 20);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].apaarId).toBe('1234****12');
    expect(result.total).toBe(1);
  });
});

describe('expireOutdatedRequests', () => {
  it('expires outdated requests', async () => {
    mockPrisma.consentRequest.updateMany.mockResolvedValue({ count: 3 });

    const result = await expireOutdatedRequests();
    expect(result).toBe(3);
  });
});
