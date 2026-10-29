import { describe, it, expect } from 'vitest';
import { validateApaarMock } from '../apaar.mock.js';

const demographics = { name: 'Test', dob: '2000-01-01', gender: 'male' };

describe('validateApaarMock', () => {
  it('returns active + match for valid 12-digit ID', async () => {
    const result = await validateApaarMock('123456789012', demographics);
    expect(result.active).toBe(true);
    expect(result.match).toBe(true);
    expect(result.fields).toEqual({ name: true, dob: true, gender: true });
  });

  it('returns inactive for IDs starting with 000', async () => {
    const result = await validateApaarMock('000456789012', demographics);
    expect(result.active).toBe(false);
    expect(result.match).toBe(false);
  });

  it('returns mismatch for IDs starting with 111', async () => {
    const result = await validateApaarMock('111456789012', demographics);
    expect(result.active).toBe(true);
    expect(result.match).toBe(false);
    expect(result.fields.name).toBe(false);
  });

  it('throws for invalid format', async () => {
    await expect(validateApaarMock('123', demographics)).rejects.toThrow('Invalid APAAR ID');
  });
});
