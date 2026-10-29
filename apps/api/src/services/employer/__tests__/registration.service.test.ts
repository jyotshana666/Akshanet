import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    employer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  mockAudit: { writeAuditEvent: vi.fn() },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/audit.js', () => mockAudit);
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  registerEmployer,
  approveEmployer,
  rejectEmployer,
  getEmployerStatus,
  getPendingEmployers,
} from '../registration.service.js';

beforeEach(() => vi.clearAllMocks());

describe('registerEmployer', () => {
  it('registers with valid CIN', async () => {
    mockPrisma.employer.findFirst.mockResolvedValue(null);
    mockPrisma.employer.findUnique.mockResolvedValue(null);
    mockPrisma.employer.create.mockResolvedValue({ id: 'emp-1' });

    const result = await registerEmployer('user-1', {
      companyName: 'Test Corp',
      cin: 'U12345MH2020PTC123456',
      industry: 'IT',
      contactName: 'John',
      contactEmail: 'john@test.com',
    });

    expect(result).toHaveProperty('employerId', 'emp-1');
    expect(mockPrisma.employer.create).toHaveBeenCalled();
  });

  it('rejects invalid CIN format', async () => {
    const result = await registerEmployer('user-1', {
      companyName: 'Test Corp',
      cin: 'INVALID',
      industry: 'IT',
      contactName: 'John',
      contactEmail: 'john@test.com',
    });

    expect(result).toHaveProperty('error', 'Invalid CIN format');
  });

  it('rejects duplicate registration', async () => {
    mockPrisma.employer.findFirst.mockResolvedValue({ id: 'emp-1', status: 'PENDING' });

    const result = await registerEmployer('user-1', {
      companyName: 'Test Corp',
      cin: 'U12345MH2020PTC123456',
      industry: 'IT',
      contactName: 'John',
      contactEmail: 'john@test.com',
    });

    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('already exists');
  });

  it('rejects duplicate CIN', async () => {
    mockPrisma.employer.findFirst.mockResolvedValue(null);
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-2' });

    const result = await registerEmployer('user-1', {
      companyName: 'Test Corp',
      cin: 'U12345MH2020PTC123456',
      industry: 'IT',
      contactName: 'John',
      contactEmail: 'john@test.com',
    });

    expect(result).toHaveProperty('error', 'CIN already registered');
  });
});

describe('approveEmployer', () => {
  it('approves a pending employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'PENDING', user_id: 'user-1' });
    mockPrisma.employer.update.mockResolvedValue({});

    const result = await approveEmployer('emp-1', 'admin-1');
    expect(result.approved).toBe(true);
  });

  it('rejects non-pending employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED', user_id: 'user-1' });

    const result = await approveEmployer('emp-1', 'admin-1');
    expect(result.approved).toBe(false);
    expect(result.error).toContain('Cannot approve');
  });
});

describe('rejectEmployer', () => {
  it('rejects a pending employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'PENDING' });
    mockPrisma.employer.update.mockResolvedValue({});

    const result = await rejectEmployer('emp-1', 'admin-1', 'Invalid documents');
    expect(result.rejected).toBe(true);
  });

  it('cannot reject already approved employer', async () => {
    mockPrisma.employer.findUnique.mockResolvedValue({ id: 'emp-1', status: 'APPROVED' });

    const result = await rejectEmployer('emp-1', 'admin-1', 'Too late');
    expect(result.rejected).toBe(false);
  });
});

describe('getEmployerStatus', () => {
  it('returns status for registered employer', async () => {
    mockPrisma.employer.findFirst.mockResolvedValue({
      id: 'emp-1', company_name: 'Test Corp', status: 'APPROVED', cin: 'U12345MH2020PTC123456', industry: 'IT',
    });

    const result = await getEmployerStatus('user-1');
    expect(result.registered).toBe(true);
    expect(result.companyName).toBe('Test Corp');
  });

  it('returns not registered for unknown user', async () => {
    mockPrisma.employer.findFirst.mockResolvedValue(null);

    const result = await getEmployerStatus('user-999');
    expect(result.registered).toBe(false);
  });
});

describe('getPendingEmployers', () => {
  it('returns paginated pending employers', async () => {
    mockPrisma.employer.findMany.mockResolvedValue([
      { id: 'emp-1', company_name: 'Corp A', cin: 'U12345MH2020PTC123456', industry: 'IT', contact_name: 'John', created_at: new Date() },
    ]);
    mockPrisma.employer.count.mockResolvedValue(1);

    const result = await getPendingEmployers(1, 20);
    expect(result.employers).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
