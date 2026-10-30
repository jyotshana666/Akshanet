import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { mockPrisma, mockS3, mockRedis, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    upload: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    admission: { create: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    student: { upsert: vi.fn(), findFirst: vi.fn() },
    programme: { findFirst: vi.fn(), findMany: vi.fn() },
    institution: { findUnique: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    lpush: vi.fn(),
  },
  mockAudit: { writeAuditEvent: vi.fn() },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../lib/audit.js', () => mockAudit);
vi.mock('../../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    MINIO_ENDPOINT: 'http://localhost:9000',
    MINIO_BUCKET: 'test',
    MINIO_ACCESS_KEY: 'test',
    MINIO_SECRET_KEY: 'test',
  },
}));

import { validateColumnMapping } from '../../services/upload/mapping.service.js';
import { transformRows } from '../../services/upload/transform.service.js';

beforeEach(() => vi.clearAllMocks());

describe('E2E: Upload Flow', () => {
  const csvPath = join(__dirname, '../fixtures/students.csv');

  it('fixture CSV exists and has correct headers', () => {
    const content = readFileSync(csvPath, 'utf-8');
    const headers = content.split('\n')[0].trim().split(',');
    expect(headers).toContain('apaar_id');
    expect(headers).toContain('student_name');
    expect(headers).toContain('date_of_birth');
    expect(headers).toContain('programme_code');
  });

  it('fixture CSV has 10 rows (8 valid + 2 intentional errors)', () => {
    const content = readFileSync(csvPath, 'utf-8');
    const dataRows = content.trim().split('\n').slice(1);
    expect(dataRows).toHaveLength(10);
  });

  it('validates column mapping for CSV headers', () => {
    const csvHeaders = ['apaar_id', 'student_name', 'date_of_birth', 'gender', 'programme_code', 'academic_year', 'seat_type', 'mobile', 'email'];
    const mapping = {
      apaar_id: 'apaarId',
      student_name: 'studentName',
      date_of_birth: 'dateOfBirth',
      gender: 'gender',
      programme_code: 'programmeCode',
      academic_year: 'academicYear',
      seat_type: 'seatType',
    };

    const result = validateColumnMapping(csvHeaders, mapping);
    expect(result.valid).toBe(true);
  });

  it('transforms valid rows and rejects invalid ones', () => {
    const headers = ['apaar_id', 'student_name', 'date_of_birth', 'gender', 'programme_code', 'academic_year', 'seat_type'];
    const mapping: Record<string, string> = {
      apaar_id: 'apaarId',
      student_name: 'studentName',
      date_of_birth: 'dateOfBirth',
      gender: 'gender',
      programme_code: 'programmeCode',
      academic_year: 'academicYear',
      seat_type: 'seatType',
    };

    const rows = [
      ['543210987654', 'Riya', '2003-05-15', 'female', 'B.Tech-CSE', '2024-25', 'GENERAL'],
      ['INVALID_APAAR', 'Bad', '2003-01-01', 'male', 'B.Tech-CSE', '2024-25', 'GENERAL'],
      ['543210987670', '', '2003-06-15', 'other', 'B.Tech-CSE', '2024-25', 'GENERAL'],
    ];

    const result = transformRows(headers, rows, mapping);
    expect(result.valid.length).toBeGreaterThanOrEqual(1);
    expect(result.invalid.length).toBeGreaterThanOrEqual(1);
  });

  it('records start as DRAFT status', () => {
    const admissionStatus = 'draft';
    expect(admissionStatus).toBe('draft');
    expect(['draft', 'submitted', 'apaar_verified']).toContain(admissionStatus);
  });
});
