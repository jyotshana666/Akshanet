import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    accessLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import { logAccess, getAccessLog } from '../accessLog.service.js';

beforeEach(() => vi.clearAllMocks());

describe('logAccess', () => {
  it('creates access log entry', async () => {
    mockPrisma.accessLog.create.mockResolvedValue({});
    await logAccess('student-1', 'emp-1', 'EMPLOYER', ['name', 'programme']);
    expect(mockPrisma.accessLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        student_id: 'student-1',
        accessor_id: 'emp-1',
        fields_accessed: ['name', 'programme'],
      }),
    });
  });
});

describe('getAccessLog', () => {
  it('returns paginated access logs', async () => {
    mockPrisma.accessLog.findMany.mockResolvedValue([
      {
        id: 'log-1', accessor_id: 'emp-1', accessor_role: 'EMPLOYER',
        fields_accessed: ['name'], accessed_at: new Date('2025-06-15'),
      },
    ]);
    mockPrisma.accessLog.count.mockResolvedValue(1);

    const result = await getAccessLog('student-1', 1, 20);
    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.logs[0].accessorId).toBe('emp-1');
  });
});
