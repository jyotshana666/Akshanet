import { prisma } from '../../lib/prisma.js';
import { transition } from '../../lib/stateMachine.js';

const SYSTEM_ACTOR = 'system:intake-enforcer';
const SYSTEM_ROLE = 'SYSTEM';

const TERMINAL_STATES = [
  'withdrawn', 'transferred', 'rejected',
  'draft', 'apaar_not_found', 'data_mismatch',
];

export async function checkIntake(
  admissionId: string,
  institutionId: string,
  programmeId: string,
  academicYear: string,
): Promise<{ exceeded: boolean; current?: number; limit?: number }> {
  const [programme, institution] = await Promise.all([
    prisma.programme.findUnique({
      where: { id: programmeId },
      select: { code: true, approved_intake: true },
    }),
    prisma.institution.findUnique({
      where: { id: institutionId },
      select: { approved_intake: true },
    }),
  ]);

  if (!programme || !institution) {
    return { exceeded: false };
  }

  const intakeMap = institution.approved_intake as Record<string, number> | null;
  const intakeKey = `${programme.code}:${academicYear}`;
  const maxSeats = intakeMap?.[intakeKey] ?? programme.approved_intake;

  const enrolledCount = await prisma.admission.count({
    where: {
      institution_id: institutionId,
      programme_id: programmeId,
      academic_year: academicYear,
      verification_status: { notIn: TERMINAL_STATES as any },
      id: { not: admissionId },
    },
  });

  if (enrolledCount >= maxSeats) {
    await transition(
      prisma, admissionId,
      'intake_exceeded',
      SYSTEM_ACTOR, SYSTEM_ROLE,
    );
    return { exceeded: true, current: enrolledCount, limit: maxSeats };
  }

  return { exceeded: false, current: enrolledCount, limit: maxSeats };
}

export async function checkAllIntake(uploadId: string): Promise<{
  checked: number;
  exceeded: number;
}> {
  const admissions = await prisma.admission.findMany({
    where: { upload_id: uploadId, verification_status: 'apaar_verified' },
    select: {
      id: true,
      institution_id: true,
      programme_id: true,
      academic_year: true,
    },
  });

  let exceeded = 0;

  for (const admission of admissions) {
    const result = await checkIntake(
      admission.id,
      admission.institution_id,
      admission.programme_id,
      admission.academic_year,
    );
    if (result.exceeded) exceeded++;
  }

  return { checked: admissions.length, exceeded };
}
