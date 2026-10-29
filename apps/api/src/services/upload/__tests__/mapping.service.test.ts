import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    upload: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { validateColumnMapping, saveColumnMapping } from '../mapping.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateColumnMapping', () => {
  const headers = ['Name', 'APAAR_ID', 'DOB', 'Gender', 'Programme', 'Year'];

  it('returns valid when all required fields are mapped', () => {
    const mapping = {
      'Name': 'studentName',
      'APAAR_ID': 'apaarId',
      'DOB': 'dateOfBirth',
      'Gender': 'gender',
      'Programme': 'programmeCode',
      'Year': 'academicYear',
    };
    const result = validateColumnMapping(headers, mapping);
    expect(result.valid).toBe(true);
  });

  it('returns unmapped required fields when some are missing', () => {
    const mapping = {
      'Name': 'studentName',
      'APAAR_ID': 'apaarId',
    };
    const result = validateColumnMapping(headers, mapping);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.unmappedRequired).toContain('dateOfBirth');
      expect(result.unmappedRequired).toContain('gender');
      expect(result.unmappedRequired).toContain('programmeCode');
      expect(result.unmappedRequired).toContain('academicYear');
    }
  });

  it('returns error when CSV column does not exist', () => {
    const mapping = {
      'NonExistent': 'studentName',
      'APAAR_ID': 'apaarId',
      'DOB': 'dateOfBirth',
      'Gender': 'gender',
      'Programme': 'programmeCode',
      'Year': 'academicYear',
    };
    const result = validateColumnMapping(headers, mapping);
    expect(result.valid).toBe(false);
  });
});

describe('saveColumnMapping', () => {
  it('saves mapping for PENDING upload', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue({ id: 'up-1', status: 'PENDING' });
    mockPrisma.upload.update.mockResolvedValue({});

    const result = await saveColumnMapping('up-1', 'inst-1', { A: 'b' });
    expect(result).toEqual({ success: true });
    expect(mockPrisma.upload.update).toHaveBeenCalledOnce();
  });

  it('returns error for non-existent upload', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue(null);
    const result = await saveColumnMapping('nope', 'inst-1', { A: 'b' });
    expect(result).toHaveProperty('error', 'Upload not found');
  });

  it('returns error for non-PENDING upload', async () => {
    mockPrisma.upload.findFirst.mockResolvedValue({ id: 'up-1', status: 'COMPLETED' });
    const result = await saveColumnMapping('up-1', 'inst-1', { A: 'b' });
    expect(result).toHaveProperty('error');
    if ('error' in result) expect(result.error).toMatch(/COMPLETED/);
  });
});
