import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3 } = vi.hoisted(() => ({
  mockPrisma: {
    upload: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../../config.js', () => ({
  config: {
    MINIO_ENDPOINT: 'http://localhost:9000',
    MINIO_BUCKET: 'test-bucket',
    MINIO_ACCESS_KEY: 'test',
    MINIO_SECRET_KEY: 'test',
    NODE_ENV: 'test',
  },
}));

import { handleCsvUpload, parseCsvRows } from '../upload.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockPrisma.upload.create.mockResolvedValue({ id: 'upload-1' });
});

describe('parseCsvRows', () => {
  it('parses headers and rows from CSV content', () => {
    const csv = 'Name,APAAR,DOB\nAlice,123456789012,2000-01-01\nBob,123456789013,2001-02-02';
    const result = parseCsvRows(csv);
    expect(result.headers).toEqual(['Name', 'APAAR', 'DOB']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual(['Alice', '123456789012', '2000-01-01']);
  });

  it('returns empty for empty content', () => {
    const result = parseCsvRows('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('strips quotes from values', () => {
    const csv = '"Name","ID"\n"Alice","123"';
    const result = parseCsvRows(csv);
    expect(result.headers).toEqual(['Name', 'ID']);
    expect(result.rows[0]).toEqual(['Alice', '123']);
  });
});

describe('handleCsvUpload', () => {
  it('rejects files exceeding 10MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
    const result = await handleCsvUpload(
      { buffer: bigBuffer, mimetype: 'text/csv', originalname: 'big.csv', size: bigBuffer.length },
      'inst-1', 'user-1',
    );
    expect(result).toHaveProperty('error');
    if ('error' in result) expect(result.error).toMatch(/maximum size/);
  });

  it('rejects non-CSV files', async () => {
    const buffer = Buffer.from('{"not":"csv"}');
    const result = await handleCsvUpload(
      { buffer, mimetype: 'application/json', originalname: 'data.json', size: buffer.length },
      'inst-1', 'user-1',
    );
    expect(result).toHaveProperty('error');
  });

  it('rejects CSV with no data rows', async () => {
    const buffer = Buffer.from('Name,APAAR,DOB\n');
    const result = await handleCsvUpload(
      { buffer, mimetype: 'text/csv', originalname: 'empty.csv', size: buffer.length },
      'inst-1', 'user-1',
    );
    expect(result).toHaveProperty('error');
    if ('error' in result) expect(result.error).toMatch(/no data/i);
  });

  it('uploads valid CSV and returns preview', async () => {
    const csv = 'Name,APAAR,DOB\nAlice,123456789012,2000-01-01\nBob,123456789013,2001-02-02';
    const buffer = Buffer.from(csv);
    const result = await handleCsvUpload(
      { buffer, mimetype: 'text/csv', originalname: 'students.csv', size: buffer.length },
      'inst-1', 'user-1',
    );
    expect(result).toHaveProperty('uploadId');
    expect(result).toHaveProperty('headers', ['Name', 'APAAR', 'DOB']);
    if ('previewRows' in result) {
      expect(result.previewRows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
    }
    expect(mockS3.putObject).toHaveBeenCalledOnce();
    expect(mockPrisma.upload.create).toHaveBeenCalledOnce();
  });

  it('returns at most 5 preview rows', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => `Student${i},${String(i).padStart(12, '0')},2000-01-01`);
    const csv = 'Name,APAAR,DOB\n' + rows.join('\n');
    const buffer = Buffer.from(csv);
    const result = await handleCsvUpload(
      { buffer, mimetype: 'text/csv', originalname: 'big.csv', size: buffer.length },
      'inst-1', 'user-1',
    );
    if ('previewRows' in result) {
      expect(result.previewRows).toHaveLength(5);
      expect(result.totalRows).toBe(10);
    }
  });
});
