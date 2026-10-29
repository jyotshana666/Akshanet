import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockWriteAudit } = vi.hoisted(() => ({
  mockPrisma: {
    consent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
  mockRedis: { lpush: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn() },
  mockWriteAudit: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: mockWriteAudit }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import { getConsents, grantConsent, revokeConsent, checkConsent } from '../consent.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
});

describe('getConsents', () => {
  it('returns all consent records', async () => {
    mockPrisma.consent.findMany.mockResolvedValue([
      {
        id: 'c-1', type: 'EMPLOYER_ACCESS', scope: 'EMPLOYER', granted_to: 'emp-1',
        status: 'GRANTED', granted_at: new Date(), revoked_at: null,
        expires_at: null, created_at: new Date(),
      },
    ]);

    const consents = await getConsents('student-1');
    expect(consents).toHaveLength(1);
    expect(consents[0].scope).toBe('EMPLOYER');
  });
});

describe('grantConsent', () => {
  it('creates new consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue(null);
    mockPrisma.consent.create.mockResolvedValue({ id: 'c-1' });

    const result = await grantConsent('student-1', 'EMPLOYER', 'emp-1');
    expect(result.consentId).toBe('c-1');
    expect(mockWriteAudit).toHaveBeenCalled();
  });

  it('returns existing consent if already granted', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue({ id: 'c-existing' });

    const result = await grantConsent('student-1', 'EMPLOYER', 'emp-1');
    expect(result.consentId).toBe('c-existing');
    expect(mockPrisma.consent.create).not.toHaveBeenCalled();
  });
});

describe('revokeConsent', () => {
  it('revokes granted consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue({
      id: 'c-1', scope: 'EMPLOYER', granted_to: 'emp-1',
    });
    mockPrisma.consent.update.mockResolvedValue({});

    const result = await revokeConsent('student-1', 'c-1');
    expect(result.revoked).toBe(true);
    expect(mockWriteAudit).toHaveBeenCalled();
  });

  it('notifies employer on revocation', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue({
      id: 'c-1', scope: 'EMPLOYER', granted_to: 'emp-1',
    });
    mockPrisma.consent.update.mockResolvedValue({});

    await revokeConsent('student-1', 'c-1');
    expect(mockRedis.lpush).toHaveBeenCalledWith(
      'queue:notification',
      expect.stringContaining('employer_access_revoked'),
    );
  });

  it('returns error for missing consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue(null);
    const result = await revokeConsent('student-1', 'c-999');
    expect(result.revoked).toBe(false);
  });
});

describe('checkConsent', () => {
  it('returns true for valid consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue({ id: 'c-1', expires_at: null });
    const result = await checkConsent('student-1', 'EMPLOYER', 'emp-1');
    expect(result).toBe(true);
  });

  it('returns false when no consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue(null);
    const result = await checkConsent('student-1', 'EMPLOYER', 'emp-1');
    expect(result).toBe(false);
  });

  it('returns false and revokes expired consent', async () => {
    mockPrisma.consent.findFirst.mockResolvedValue({
      id: 'c-1',
      expires_at: new Date('2020-01-01'),
    });
    mockPrisma.consent.update.mockResolvedValue({});

    const result = await checkConsent('student-1', 'EMPLOYER', 'emp-1');
    expect(result).toBe(false);
    expect(mockPrisma.consent.update).toHaveBeenCalled();
  });
});
