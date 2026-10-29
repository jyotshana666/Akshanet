import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    upload: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
  mockRedis: {
    lpush: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  getDashboardStats,
  getSubmissions,
  getSubmissionRecords,
  bulkNotifyStudents,
} from '../dashboard.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.lpush.mockResolvedValue(1);
});

describe('getDashboardStats', () => {
  it('returns correct stats', async () => {
    mockPrisma.admission.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(40)   // verified
      .mockResolvedValueOnce(30)   // pending
      .mockResolvedValueOnce(10)   // flagged
      .mockResolvedValueOnce(80);  // apaar covered

    const stats = await getDashboardStats('inst-1');
    expect(stats.totalStudents).toBe(100);
    expect(stats.verifiedCount).toBe(40);
    expect(stats.pendingCount).toBe(30);
    expect(stats.flaggedCount).toBe(10);
    expect(stats.apaarCoveragePct).toBe(80);
  });

  it('returns 0% coverage when no students', async () => {
    mockPrisma.admission.count.mockResolvedValue(0);
    const stats = await getDashboardStats('inst-1');
    expect(stats.apaarCoveragePct).toBe(0);
  });
});

describe('getSubmissions', () => {
  it('returns paginated submissions with status breakdown', async () => {
    mockPrisma.upload.findMany.mockResolvedValue([
      {
        id: 'up-1',
        filename: 'test.csv',
        status: 'COMPLETED',
        row_count: 50,
        created_count: 45,
        skipped_count: 3,
        failed_count: 2,
        created_at: new Date('2025-01-01'),
      },
    ]);
    mockPrisma.upload.count.mockResolvedValue(1);
    mockPrisma.admission.groupBy.mockResolvedValue([
      { verification_status: 'draft', _count: { id: 30 } },
      { verification_status: 'submitted', _count: { id: 15 } },
    ]);

    const result = await getSubmissions('inst-1', 1, 20);
    expect(result.total).toBe(1);
    expect(result.submissions).toHaveLength(1);
    expect(result.submissions[0].statusBreakdown).toEqual({
      draft: 30,
      submitted: 15,
    });
  });
});

describe('getSubmissionRecords', () => {
  it('returns error for non-existent upload', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue(null);
    const result = await getSubmissionRecords('nope', 'inst-1', 1, 20);
    expect(result).toHaveProperty('error', 'Upload not found');
  });

  it('returns paginated records', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue({ id: 'up-1' });
    mockPrisma.admission.findMany.mockResolvedValue([
      {
        id: 'adm-1',
        apaar_id: '123456789012',
        academic_year: '2025-26',
        verification_status: 'draft',
        created_at: new Date('2025-01-01'),
        student: { name: 'Alice' },
        programme: { code: 'BTECH-CSE' },
      },
    ]);
    mockPrisma.admission.count.mockResolvedValue(1);

    const result = await getSubmissionRecords('up-1', 'inst-1', 1, 20);
    expect(result).not.toHaveProperty('error');
    if ('records' in result) {
      expect(result.records).toHaveLength(1);
      expect(result.records[0].apaarId).toBe('123456789012');
      expect(result.records[0].studentName).toBe('Alice');
      expect(result.total).toBe(1);
    }
  });
});

describe('bulkNotifyStudents', () => {
  it('returns error for non-existent upload', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue(null);
    const result = await bulkNotifyStudents('nope', 'inst-1', 'user-1');
    expect(result).toHaveProperty('error', 'Upload not found');
  });

  it('enqueues notification for each admission', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue({ id: 'up-1' });
    mockPrisma.admission.findMany.mockResolvedValue([
      { id: 'adm-1', student_id: 's-1', apaar_id: '123456789012', verification_status: 'draft' },
      { id: 'adm-2', student_id: 's-2', apaar_id: '123456789013', verification_status: 'submitted' },
    ]);

    const result = await bulkNotifyStudents('up-1', 'inst-1', 'user-1');
    expect(result).toHaveProperty('enqueued', 2);
    expect(mockRedis.lpush).toHaveBeenCalledTimes(2);
  });
});
