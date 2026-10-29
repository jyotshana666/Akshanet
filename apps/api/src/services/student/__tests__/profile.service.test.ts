import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import { getProfile } from '../profile.service.js';

beforeEach(() => vi.clearAllMocks());

describe('getProfile', () => {
  it('returns student profile with safe fields', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      apaar_id: '123456789012',
      academic_year: '2025-26',
      verification_status: 'apaar_verified',
      apaar_validated_at: new Date('2025-06-15'),
      apaar_risk_score: 0.1,
      student: { name: 'Test Student' },
      programme: { name: 'B.Tech CSE', code: 'BTECH-CSE' },
      institution: { name: 'IIT Test' },
      _count: { flags: 0 },
    });

    const result = await getProfile('123456789012');
    expect(result).not.toHaveProperty('error');
    if (!('error' in result)) {
      expect(result.name).toBe('Test Student');
      expect(result.apaarId).toBe('123456789012');
      expect(result.institutionName).toBe('IIT Test');
      expect(result.flagsRaised).toBe(0);
    }
  });

  it('returns error when no record found', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue(null);
    const result = await getProfile('999999999999');
    expect(result).toHaveProperty('error');
  });

  it('does not expose mobile_hash or email_hash', async () => {
    mockPrisma.admission.findFirst.mockResolvedValue({
      apaar_id: '123456789012',
      academic_year: '2025-26',
      verification_status: 'apaar_verified',
      apaar_validated_at: null,
      apaar_risk_score: null,
      student: { name: 'Test' },
      programme: { name: 'B.Tech', code: 'BTECH' },
      institution: { name: 'IIT' },
      _count: { flags: 0 },
    });

    const result = await getProfile('123456789012');
    expect(result).not.toHaveProperty('mobile_hash');
    expect(result).not.toHaveProperty('email_hash');
  });
});
