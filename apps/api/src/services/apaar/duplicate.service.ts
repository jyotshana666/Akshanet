import { prisma } from '../../lib/prisma.js';
import { transition } from '../../lib/stateMachine.js';
import { notificationQueue } from '../../lib/queues.js';

const SYSTEM_ACTOR = 'system:duplicate-detector';
const SYSTEM_ROLE = 'SYSTEM';

const TERMINAL_STATES = ['withdrawn', 'transferred', 'rejected'];

export async function checkDuplicate(
  apaarId: string,
  academicYear: string,
  institutionId: string,
  admissionId: string,
): Promise<{ duplicate: boolean; pairId?: string }> {
  const existing = await prisma.admission.findMany({
    where: {
      apaar_id: apaarId,
      academic_year: academicYear,
      institution_id: { not: institutionId },
      verification_status: { notIn: TERMINAL_STATES as any },
      id: { not: admissionId },
    },
    select: { id: true, institution_id: true },
  });

  if (existing.length === 0) {
    return { duplicate: false };
  }

  const other = existing[0];

  const pair = await prisma.duplicatePair.create({
    data: {
      apaar_id: apaarId,
      admission_id_a: admissionId,
      admission_id_b: other.id,
      academic_year: academicYear,
    },
    select: { id: true },
  });

  await transition(
    prisma, admissionId,
    'duplicate_flagged',
    SYSTEM_ACTOR, SYSTEM_ROLE,
  );

  const otherAdmission = await prisma.admission.findUnique({
    where: { id: other.id },
    select: { verification_status: true },
  });

  if (
    otherAdmission &&
    !TERMINAL_STATES.includes(otherAdmission.verification_status as any) &&
    otherAdmission.verification_status !== 'duplicate_flagged'
  ) {
    await transition(
      prisma, other.id,
      'duplicate_flagged',
      SYSTEM_ACTOR, SYSTEM_ROLE,
    );
  }

  await notificationQueue.add(`dup-${pair.id}-a`, {
    type: 'duplicate_flagged',
    admissionId,
    pairId: pair.id,
    institutionId,
  });

  await notificationQueue.add(`dup-${pair.id}-b`, {
    type: 'duplicate_flagged',
    admissionId: other.id,
    pairId: pair.id,
    institutionId: other.institution_id,
  });

  return { duplicate: true, pairId: pair.id };
}

export async function resolveDuplicate(
  pairId: string,
  validAdmissionId: string,
  actorId: string,
): Promise<{ resolved: boolean; error?: string }> {
  const pair = await prisma.duplicatePair.findUnique({
    where: { id: pairId },
    select: {
      id: true,
      status: true,
      admission_id_a: true,
      admission_id_b: true,
    },
  });

  if (!pair) {
    return { resolved: false, error: 'Duplicate pair not found' };
  }

  if (pair.status === 'RESOLVED') {
    return { resolved: false, error: 'Already resolved' };
  }

  if (validAdmissionId !== pair.admission_id_a && validAdmissionId !== pair.admission_id_b) {
    return { resolved: false, error: 'Admission not part of this duplicate pair' };
  }

  const loserId = validAdmissionId === pair.admission_id_a
    ? pair.admission_id_b
    : pair.admission_id_a;

  await transition(
    prisma, loserId,
    'rejected',
    actorId, 'AICTE',
  );

  await transition(
    prisma, validAdmissionId,
    'apaar_verified',
    actorId, 'AICTE',
  );

  await prisma.duplicatePair.update({
    where: { id: pairId },
    data: {
      status: 'RESOLVED',
      resolved_by: actorId,
      resolved_at: new Date(),
    },
  });

  return { resolved: true };
}
