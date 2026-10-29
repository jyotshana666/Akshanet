import { prisma } from '../../lib/prisma.js';
import { sha256 } from '../../lib/hash.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { apaarValidationQueue } from '../../lib/queues.js';
import type { AdmissionRecord } from './transform.service.js';

interface IngestResult {
  created: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string }[];
}

export async function ingestRecords(
  uploadId: string,
  institutionId: string,
  actorId: string,
  records: AdmissionRecord[],
  ipAddress?: string,
): Promise<IngestResult> {
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { row: number; reason: string }[] = [];

  const seenApaarYears = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const dedupeKey = `${record.apaarId}:${record.academicYear}`;

    if (seenApaarYears.has(dedupeKey)) {
      skipped++;
      errors.push({ row: i + 1, reason: 'Duplicate APAAR ID + academic year within upload' });
      continue;
    }
    seenApaarYears.add(dedupeKey);

    try {
      const programme = await prisma.programme.findFirst({
        where: {
          institution_id: institutionId,
          code: record.programmeCode,
          academic_year: record.academicYear,
        },
        select: { id: true },
      });

      if (!programme) {
        failed++;
        errors.push({ row: i + 1, reason: `Programme ${record.programmeCode} not found for ${record.academicYear}` });
        continue;
      }

      const student = await prisma.student.upsert({
        where: { apaar_id: record.apaarId },
        update: {
          name: record.studentName,
          date_of_birth: new Date(record.dateOfBirth),
          gender: record.gender,
        },
        create: {
          apaar_id: record.apaarId,
          name: record.studentName,
          date_of_birth: new Date(record.dateOfBirth),
          gender: record.gender,
        },
        select: { id: true },
      });

      const existingAdmission = await prisma.admission.findUnique({
        where: {
          apaar_id_academic_year: {
            apaar_id: record.apaarId,
            academic_year: record.academicYear,
          },
        },
        select: { id: true },
      });

      if (existingAdmission) {
        skipped++;
        errors.push({ row: i + 1, reason: 'Admission already exists for this APAAR ID and academic year' });
        continue;
      }

      const admission = await prisma.admission.create({
        data: {
          student_id: student.id,
          institution_id: institutionId,
          programme_id: programme.id,
          upload_id: uploadId,
          apaar_id: record.apaarId,
          academic_year: record.academicYear,
          verification_status: 'draft',
        },
        select: { id: true },
      });

      await writeAuditEvent({
        actorId,
        institutionId,
        admissionId: admission.id,
        action: 'CREATE',
        targetTable: 'admissions',
        targetId: admission.id,
        newValue: {
          apaarId: record.apaarId,
          academicYear: record.academicYear,
          programmeCode: record.programmeCode,
        },
        ipAddress,
      });

      await apaarValidationQueue.add(admission.id, {
        admissionId: admission.id,
        apaarId: record.apaarId,
        studentId: student.id,
      });

      created++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: i + 1, reason: message });
    }
  }

  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      status: 'COMPLETED',
      created_count: created,
      skipped_count: skipped,
      failed_count: failed,
      error_details: errors.length > 0 ? (errors as any) : undefined,
    },
  });

  return { created, skipped, failed, errors };
}
