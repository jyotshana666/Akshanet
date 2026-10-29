import { describe, it, expect } from 'vitest';
import { transformRows } from '../transform.service.js';

describe('transformRows', () => {
  const headers = ['Name', 'APAAR', 'DOB', 'Sex', 'Course', 'AY'];
  const mapping = {
    'Name': 'studentName',
    'APAAR': 'apaarId',
    'DOB': 'dateOfBirth',
    'Sex': 'gender',
    'Course': 'programmeCode',
    'AY': 'academicYear',
  };

  it('transforms valid rows correctly', () => {
    const rows = [
      ['Alice', '123456789012', '2000-01-01', 'female', 'BTECH-CSE', '2025-26'],
    ];
    const result = transformRows(headers, rows, mapping);
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].apaarId).toBe('123456789012');
    expect(result.valid[0].studentName).toBe('Alice');
  });

  it('reports invalid rows with errors', () => {
    const rows = [
      ['Alice', 'bad-apaar', '2000-01-01', 'female', 'BTECH-CSE', '2025-26'],
    ];
    const result = transformRows(headers, rows, mapping);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].row).toBe(2); // 1-indexed + header
    expect(result.invalid[0].errors[0]).toMatch(/apaarId/);
  });

  it('handles mixed valid and invalid rows', () => {
    const rows = [
      ['Alice', '123456789012', '2000-01-01', 'female', 'BTECH-CSE', '2025-26'],
      ['Bob', 'short', 'bad-date', 'male', 'BTECH-CSE', '2025-26'],
      ['Carol', '123456789014', '2001-03-15', 'male', 'BTECH-ECE', '2025-26'],
    ];
    const result = transformRows(headers, rows, mapping);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });

  it('parses feeAmount as number', () => {
    const headersWithFee = [...headers, 'Fee'];
    const mappingWithFee = { ...mapping, 'Fee': 'feeAmount' };
    const rows = [
      ['Alice', '123456789012', '2000-01-01', 'female', 'BTECH-CSE', '2025-26', '50000'],
    ];
    const result = transformRows(headersWithFee, rows, mappingWithFee);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].feeAmount).toBe(50000);
  });
});
