import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { s3 } from '../../lib/s3.js';
import { writeAuditEvent } from '../../lib/audit.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const CSV_MAGIC_BYTES = [0x22, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49];

function looksLikeCsv(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf-8');
  return head.includes(',') && head.includes('\n');
}

function parseCsvRows(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')),
  );

  return { headers, rows };
}

interface UploadResult {
  uploadId: string;
  headers: string[];
  previewRows: string[][];
  totalRows: number;
}

export async function handleCsvUpload(
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  institutionId: string,
  uploadedBy: string,
  ipAddress?: string,
): Promise<UploadResult | { error: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && !looksLikeCsv(file.buffer)) {
    return { error: 'File must be a CSV' };
  }

  if (!looksLikeCsv(file.buffer)) {
    return { error: 'File content does not appear to be valid CSV' };
  }

  const content = file.buffer.toString('utf-8');
  const { headers, rows } = parseCsvRows(content);

  if (headers.length === 0) {
    return { error: 'CSV file has no headers' };
  }
  if (rows.length === 0) {
    return { error: 'CSV file has no data rows' };
  }

  const uploadId = randomUUID();
  const s3Key = `uploads/${institutionId}/${uploadId}/${file.originalname}`;

  await s3.putObject({
    key: s3Key,
    body: file.buffer,
    contentType: 'text/csv',
  });

  await prisma.upload.create({
    data: {
      id: uploadId,
      institution_id: institutionId,
      uploaded_by: uploadedBy,
      filename: file.originalname,
      s3_key: s3Key,
      row_count: rows.length,
      status: 'PENDING',
    },
  });

  await writeAuditEvent({
    actorId: uploadedBy,
    institutionId,
    action: 'UPLOAD',
    targetTable: 'uploads',
    targetId: uploadId,
    newValue: { filename: file.originalname, rowCount: rows.length },
    ipAddress,
  });

  return {
    uploadId,
    headers,
    previewRows: rows.slice(0, 5),
    totalRows: rows.length,
  };
}

export { parseCsvRows };
