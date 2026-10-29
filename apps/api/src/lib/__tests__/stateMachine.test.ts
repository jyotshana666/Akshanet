import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    admission: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock('../prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../audit.js', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../config.js', () => ({
  config: { NODE_ENV: 'test' },
}));

import { canTransition, transition } from '../stateMachine.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canTransition', () => {
  it('allows valid transitions', () => {
    expect(canTransition('draft', 'submitted')).toEqual({ ok: true });
    expect(canTransition('submitted', 'apaar_verified')).toEqual({ ok: true });
    expect(canTransition('submitted', 'data_mismatch')).toEqual({ ok: true });
    expect(canTransition('submitted', 'apaar_retry_pending')).toEqual({ ok: true });
    expect(canTransition('apaar_verified', 'duplicate_flagged')).toEqual({ ok: true });
    expect(canTransition('apaar_verified', 'intake_exceeded')).toEqual({ ok: true });
  });

  it('rejects invalid transitions', () => {
    const result = canTransition('draft', 'apaar_verified');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('rejects unknown states', () => {
    const result = canTransition('nonexistent', 'submitted');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown state');
  });

  it('rejects transitions from terminal states', () => {
    expect(canTransition('rejected', 'draft').ok).toBe(false);
    expect(canTransition('withdrawn', 'draft').ok).toBe(false);
  });
});

describe('transition', () => {
  it('updates admission status and writes audit', async () => {
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'draft',
      institution_id: 'inst-1',
    });
    mockPrisma.admission.update.mockResolvedValue({});

    await transition(mockPrisma as any, 'adm-1', 'submitted', 'user-1', 'SYSTEM');

    expect(mockPrisma.admission.update).toHaveBeenCalledWith({
      where: { id: 'adm-1' },
      data: { verification_status: 'submitted' },
    });
  });

  it('throws on illegal transition', async () => {
    mockPrisma.admission.findUniqueOrThrow.mockResolvedValue({
      verification_status: 'draft',
      institution_id: 'inst-1',
    });

    await expect(
      transition(mockPrisma as any, 'adm-1', 'apaar_verified', 'user-1', 'SYSTEM'),
    ).rejects.toThrow('not allowed');
  });
});
