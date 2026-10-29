import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { s3 } from '../../lib/s3.js';
import { config } from '../../config.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { logAccess } from '../student/accessLog.service.js';
import { checkConsent } from '../student/consent.service.js';

const ALLOWED_FIELDS = [
  'name',
  'programme',
  'academicYear',
  'institutionName',
  'verificationStatus',
  'verifiedDate',
] as const;

export async function getVerifiedRecord(
  employerId: string,
  apaarId: string,
): Promise<{
  record: {
    name: string;
    programme: string;
    academicYear: string;
    institutionName: string;
    verificationStatus: string;
    verifiedDate: string | null;
  };
} | { error: string }> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true, status: true, user_id: true },
  });

  if (!employer || employer.status !== 'APPROVED') {
    return { error: 'Employer not approved' };
  }

  const student = await prisma.student.findFirst({
    where: { apaar_id: apaarId },
    select: { id: true },
  });

  if (!student) {
    return { error: 'Student not found' };
  }

  const hasConsent = await checkConsent(student.id, 'EMPLOYER', employerId);
  if (!hasConsent) {
    return { error: 'No active consent from student' };
  }

  const blocked = await prisma.employerBlock.findUnique({
    where: { student_id_employer_id: { student_id: student.id, employer_id: employerId } },
    select: { id: true },
  });

  if (blocked) {
    return { error: 'Access blocked by student' };
  }

  const admission = await prisma.admission.findFirst({
    where: { apaar_id: apaarId, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } },
    orderBy: { created_at: 'desc' },
    select: {
      academic_year: true,
      verification_status: true,
      verified_at: true,
      student: { select: { name: true } },
      programme: { select: { name: true } },
      institution: { select: { name: true } },
    },
  });

  if (!admission) {
    return { error: 'No verified admission record found' };
  }

  await logAccess(
    student.id,
    employerId,
    'EMPLOYER',
    [...ALLOWED_FIELDS],
  );

  await writeAuditEvent({
    actorId: employerId,
    action: 'VERIFY',
    targetTable: 'admissions',
    targetId: student.id,
    newValue: { fieldsAccessed: [...ALLOWED_FIELDS] },
  });

  return {
    record: {
      name: admission.student.name,
      programme: admission.programme.name,
      academicYear: admission.academic_year,
      institutionName: admission.institution.name,
      verificationStatus: admission.verification_status,
      verifiedDate: admission.verified_at?.toISOString().split('T')[0] ?? null,
    },
  };
}

export async function generateVerificationCertificate(
  employerId: string,
  apaarId: string,
): Promise<{ url: string } | { error: string }> {
  const recordResult = await getVerifiedRecord(employerId, apaarId);

  if ('error' in recordResult) {
    return { error: recordResult.error };
  }

  const { record } = recordResult;

  const maskedApaar = apaarId.slice(0, 4) + '**' + apaarId.slice(-2);
  const certHash = createHash('sha256')
    .update(employerId + apaarId + new Date().toISOString().split('T')[0] + config.JWT_SECRET)
    .digest('hex');

  const htmlContent = `
    <h1>Akshanet Employer Verification Certificate</h1>
    <p><strong>Student:</strong> ${record.name}</p>
    <p><strong>APAAR ID:</strong> ${maskedApaar}</p>
    <p><strong>Institution:</strong> ${record.institutionName}</p>
    <p><strong>Programme:</strong> ${record.programme}</p>
    <p><strong>Academic Year:</strong> ${record.academicYear}</p>
    <p><strong>Status:</strong> ${record.verificationStatus}</p>
    <p><strong>Certificate Hash:</strong> ${certHash}</p>
    <p><strong>Generated:</strong> ${new Date().toISOString().split('T')[0]}</p>
  `.trim();

  const pdfBuffer = Buffer.from(htmlContent, 'utf-8');
  const s3Key = `employer-certs/${employerId}-${Date.now()}.html`;

  await s3.putObject({
    key: s3Key,
    body: pdfBuffer,
    contentType: 'text/html',
  });

  const url = s3.getSignedUrl(s3Key, 900);
  return { url };
}

export async function blockEmployer(
  studentId: string,
  employerId: string,
  reason?: string,
): Promise<{ blocked: boolean; error?: string }> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true },
  });

  if (!employer) {
    return { blocked: false, error: 'Employer not found' };
  }

  const existing = await prisma.employerBlock.findUnique({
    where: { student_id_employer_id: { student_id: studentId, employer_id: employerId } },
    select: { id: true },
  });

  if (existing) {
    return { blocked: true };
  }

  await prisma.employerBlock.create({
    data: {
      student_id: studentId,
      employer_id: employerId,
      reason: reason ?? null,
    },
  });

  const activeConsent = await prisma.consent.findFirst({
    where: {
      student_id: studentId,
      granted_to: employerId,
      scope: 'EMPLOYER',
      status: 'GRANTED',
    },
    select: { id: true },
  });

  if (activeConsent) {
    await prisma.consent.update({
      where: { id: activeConsent.id },
      data: { status: 'REVOKED', revoked_at: new Date() },
    });
  }

  await prisma.consentRequest.updateMany({
    where: {
      student_id: studentId,
      employer_id: employerId,
      status: 'PENDING',
    },
    data: { status: 'DENIED', responded_at: new Date() },
  });

  await writeAuditEvent({
    actorId: studentId,
    action: 'CREATE',
    targetTable: 'employer_blocks',
    targetId: employerId,
    newValue: { employerId, reason },
  });

  return { blocked: true };
}
