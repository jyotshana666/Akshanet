import { prisma } from '../../lib/prisma.js';
import { notificationQueue } from '../../lib/queues.js';

interface DashboardStats {
  totalStudents: number;
  verifiedCount: number;
  pendingCount: number;
  flaggedCount: number;
  apaarCoveragePct: number;
}

export async function getDashboardStats(institutionId: string): Promise<DashboardStats> {
  const [total, verified, pending, flagged, apaarVerified] = await Promise.all([
    prisma.admission.count({ where: { institution_id: institutionId } }),
    prisma.admission.count({
      where: {
        institution_id: institutionId,
        verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] },
      },
    }),
    prisma.admission.count({
      where: {
        institution_id: institutionId,
        verification_status: { in: ['draft', 'submitted', 'apaar_retry_pending'] },
      },
    }),
    prisma.admission.count({
      where: {
        institution_id: institutionId,
        verification_status: {
          in: ['data_mismatch', 'duplicate_flagged', 'fraud_escalation', 'anomaly_watch', 'student_flagged'],
        },
      },
    }),
    prisma.admission.count({
      where: {
        institution_id: institutionId,
        verification_status: { notIn: ['draft', 'apaar_not_found'] },
      },
    }),
  ]);

  return {
    totalStudents: total,
    verifiedCount: verified,
    pendingCount: pending,
    flaggedCount: flagged,
    apaarCoveragePct: total > 0 ? Math.round((apaarVerified / total) * 10000) / 100 : 0,
  };
}

interface SubmissionSummary {
  uploadId: string;
  filename: string;
  status: string;
  totalRows: number;
  created: number;
  skipped: number;
  failed: number;
  createdAt: string;
  statusBreakdown: Record<string, number>;
}

export async function getSubmissions(
  institutionId: string,
  page: number,
  limit: number,
): Promise<{ submissions: SubmissionSummary[]; total: number }> {
  const [uploads, total] = await Promise.all([
    prisma.upload.findMany({
      where: { institution_id: institutionId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        filename: true,
        status: true,
        row_count: true,
        created_count: true,
        skipped_count: true,
        failed_count: true,
        created_at: true,
      },
    }),
    prisma.upload.count({ where: { institution_id: institutionId } }),
  ]);

  const submissions: SubmissionSummary[] = [];

  for (const upload of uploads) {
    const statusCounts = await prisma.admission.groupBy({
      by: ['verification_status'],
      where: { upload_id: upload.id, institution_id: institutionId },
      _count: { id: true },
    });

    const statusBreakdown: Record<string, number> = {};
    for (const group of statusCounts) {
      statusBreakdown[group.verification_status] = group._count.id;
    }

    submissions.push({
      uploadId: upload.id,
      filename: upload.filename,
      status: upload.status,
      totalRows: upload.row_count ?? 0,
      created: upload.created_count,
      skipped: upload.skipped_count,
      failed: upload.failed_count,
      createdAt: upload.created_at.toISOString(),
      statusBreakdown,
    });
  }

  return { submissions, total };
}

interface RecordListItem {
  admissionId: string;
  apaarId: string;
  studentName: string;
  programmeCode: string;
  academicYear: string;
  verificationStatus: string;
  createdAt: string;
}

export async function getSubmissionRecords(
  uploadId: string,
  institutionId: string,
  page: number,
  limit: number,
): Promise<{ records: RecordListItem[]; total: number } | { error: string }> {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, institution_id: institutionId },
    select: { id: true },
  });

  if (!upload) {
    return { error: 'Upload not found' };
  }

  const [admissions, total] = await Promise.all([
    prisma.admission.findMany({
      where: { upload_id: uploadId, institution_id: institutionId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        apaar_id: true,
        academic_year: true,
        verification_status: true,
        created_at: true,
        student: { select: { name: true } },
        programme: { select: { code: true } },
      },
    }),
    prisma.admission.count({
      where: { upload_id: uploadId, institution_id: institutionId },
    }),
  ]);

  const records: RecordListItem[] = admissions.map((a: typeof admissions[number]) => ({
    admissionId: a.id,
    apaarId: a.apaar_id,
    studentName: a.student.name,
    programmeCode: a.programme.code,
    academicYear: a.academic_year,
    verificationStatus: a.verification_status,
    createdAt: a.created_at.toISOString(),
  }));

  return { records, total };
}

export async function bulkNotifyStudents(
  uploadId: string,
  institutionId: string,
  actorId: string,
): Promise<{ enqueued: number } | { error: string }> {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, institution_id: institutionId },
    select: { id: true },
  });

  if (!upload) {
    return { error: 'Upload not found' };
  }

  const admissions = await prisma.admission.findMany({
    where: { upload_id: uploadId, institution_id: institutionId },
    select: {
      id: true,
      student_id: true,
      apaar_id: true,
      verification_status: true,
    },
  });

  let enqueued = 0;
  for (const admission of admissions) {
    await notificationQueue.add(admission.id, {
      type: 'status_update',
      admissionId: admission.id,
      studentId: admission.student_id,
      apaarId: admission.apaarId,
      status: admission.verification_status,
      institutionId,
      triggeredBy: actorId,
    });
    enqueued++;
  }

  return { enqueued };
}
