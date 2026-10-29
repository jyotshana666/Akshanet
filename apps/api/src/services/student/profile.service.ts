import { prisma } from '../../lib/prisma.js';

interface StudentProfile {
  name: string;
  apaarId: string;
  programme: string;
  programmeCode: string;
  academicYear: string;
  institutionName: string;
  verificationStatus: string;
  apaarValidatedAt: string | null;
  riskScore: number | null;
  flagsRaised: number;
}

export async function getProfile(
  apaarId: string,
): Promise<StudentProfile | { error: string }> {
  const admission = await prisma.admission.findFirst({
    where: { apaar_id: apaarId },
    orderBy: { created_at: 'desc' },
    select: {
      apaar_id: true,
      academic_year: true,
      verification_status: true,
      apaar_validated_at: true,
      apaar_risk_score: true,
      student: { select: { name: true } },
      programme: { select: { name: true, code: true } },
      institution: { select: { name: true } },
      _count: { select: { flags: true } },
    },
  });

  if (!admission) {
    return { error: 'No admission record found' };
  }

  return {
    name: admission.student.name,
    apaarId: admission.apaar_id,
    programme: admission.programme.name,
    programmeCode: admission.programme.code,
    academicYear: admission.academic_year,
    institutionName: admission.institution.name,
    verificationStatus: admission.verification_status,
    apaarValidatedAt: admission.apaar_validated_at?.toISOString() ?? null,
    riskScore: admission.apaar_risk_score,
    flagsRaised: admission._count.flags,
  };
}
