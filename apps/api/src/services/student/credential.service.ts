import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { s3 } from '../../lib/s3.js';
import { config } from '../../config.js';

const CREDENTIAL_STATES = ['student_verified', 'aicte_approved', 'submitted_to_aicte'];

function maskApaarId(apaarId: string): string {
  if (apaarId.length < 6) return '****';
  return apaarId.slice(0, 4) + '**' + apaarId.slice(-2);
}

function computeVerificationHash(
  apaarId: string,
  institutionId: string,
  academicYear: string,
): string {
  return createHash('sha256')
    .update(apaarId + institutionId + academicYear + config.JWT_SECRET)
    .digest('hex');
}

export async function generatePdf(
  admissionId: string,
  studentId: string,
  apaarId: string,
): Promise<{ url: string } | { error: string }> {
  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, apaar_id: apaarId },
    select: {
      id: true,
      apaar_id: true,
      academic_year: true,
      verification_status: true,
      verified_at: true,
      institution_id: true,
      student: { select: { name: true } },
      programme: { select: { name: true, code: true } },
      institution: { select: { name: true } },
    },
  });

  if (!admission) {
    return { error: 'Admission not found or does not belong to you' };
  }

  if (!CREDENTIAL_STATES.includes(admission.verification_status)) {
    return { error: `Cannot generate credential in ${admission.verification_status} state` };
  }

  const verificationHash = computeVerificationHash(
    admission.apaar_id,
    admission.institution_id,
    admission.academic_year,
  );

  const maskedApaar = maskApaarId(admission.apaar_id);
  const verifiedDate = admission.verified_at?.toISOString().split('T')[0] ?? 'Pending';

  const htmlContent = `
    <h1>Akshanet Verified Credential</h1>
    <p><strong>Student:</strong> ${admission.student.name}</p>
    <p><strong>APAAR ID:</strong> ${maskedApaar}</p>
    <p><strong>Institution:</strong> ${admission.institution.name}</p>
    <p><strong>Programme:</strong> ${admission.programme.name} (${admission.programme.code})</p>
    <p><strong>Academic Year:</strong> ${admission.academic_year}</p>
    <p><strong>Verified Date:</strong> ${verifiedDate}</p>
    <p><strong>Verification:</strong> ${verificationHash}</p>
  `.trim();

  const pdfBuffer = Buffer.from(htmlContent, 'utf-8');

  const s3Key = `credentials/${admissionId}-${Date.now()}.html`;
  await s3.putObject({
    key: s3Key,
    body: pdfBuffer,
    contentType: 'text/html',
  });

  const url = s3.getSignedUrl(s3Key, 900);

  return { url };
}

export async function verifyCredential(
  hash: string,
): Promise<{
  valid: boolean;
  name?: string;
  college?: string;
  programme?: string;
  verifiedDate?: string;
}> {
  const admissions = await prisma.admission.findMany({
    where: {
      verification_status: { in: CREDENTIAL_STATES as any },
    },
    select: {
      apaar_id: true,
      institution_id: true,
      academic_year: true,
      verified_at: true,
      student: { select: { name: true } },
      institution: { select: { name: true } },
      programme: { select: { name: true } },
    },
    take: 1000,
  });

  for (const admission of admissions) {
    const computed = computeVerificationHash(
      admission.apaar_id,
      admission.institution_id,
      admission.academic_year,
    );
    if (computed === hash) {
      return {
        valid: true,
        name: admission.student.name,
        college: admission.institution.name,
        programme: admission.programme.name,
        verifiedDate: admission.verified_at?.toISOString().split('T')[0],
      };
    }
  }

  return { valid: false };
}
