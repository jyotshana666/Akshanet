import { prisma } from '../../lib/prisma.js';
import { transition } from '../../lib/stateMachine.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { notificationQueue } from '../../lib/queues.js';

const VERIFIABLE_STATES = ['apaar_verified', 'anomaly_watch'];
const FLAGGABLE_STATES = ['apaar_verified', 'anomaly_watch'];

export async function verifyRecord(
  admissionId: string,
  studentId: string,
  apaarId: string,
): Promise<{ verified: boolean; error?: string }> {
  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, apaar_id: apaarId },
    select: {
      id: true,
      verification_status: true,
      institution_id: true,
      student: { select: { name: true } },
    },
  });

  if (!admission) {
    return { verified: false, error: 'Admission not found or does not belong to you' };
  }

  if (!VERIFIABLE_STATES.includes(admission.verification_status)) {
    return {
      verified: false,
      error: `Cannot verify from ${admission.verification_status} state`,
    };
  }

  await transition(prisma, admissionId, 'student_verified', studentId, 'STUDENT');

  await prisma.admission.update({
    where: { id: admissionId },
    data: { verified_at: new Date() },
  });

  await writeAuditEvent({
    actorId: studentId,
    institutionId: admission.institution_id,
    admissionId,
    action: 'VERIFY',
    targetTable: 'admissions',
    targetId: admissionId,
    newValue: { action: 'student_verified' },
  });

  await notificationQueue.add(`verify-${admissionId}`, {
    type: 'student_verified',
    admissionId,
    institutionId: admission.institution_id,
    studentName: admission.student.name,
  });

  return { verified: true };
}

export async function flagRecord(
  admissionId: string,
  studentId: string,
  apaarId: string,
  fieldName: string,
  reason: string,
): Promise<{ flagged: boolean; flagId?: string; error?: string }> {
  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, apaar_id: apaarId },
    select: {
      id: true,
      verification_status: true,
      institution_id: true,
    },
  });

  if (!admission) {
    return { flagged: false, error: 'Admission not found or does not belong to you' };
  }

  if (!FLAGGABLE_STATES.includes(admission.verification_status)) {
    return {
      flagged: false,
      error: `Cannot flag from ${admission.verification_status} state`,
    };
  }

  const flag = await prisma.flag.create({
    data: {
      admission_id: admissionId,
      student_id: studentId,
      field_name: fieldName,
      reason,
    },
    select: { id: true },
  });

  await transition(prisma, admissionId, 'student_flagged', studentId, 'STUDENT');

  await writeAuditEvent({
    actorId: studentId,
    institutionId: admission.institution_id,
    admissionId,
    action: 'STATUS_CHANGE',
    targetTable: 'flags',
    targetId: flag.id,
    newValue: { fieldName, reason, action: 'student_flagged' },
  });

  await notificationQueue.add(`flag-${flag.id}`, {
    type: 'flag_raised',
    admissionId,
    flagId: flag.id,
    institutionId: admission.institution_id,
    fieldName,
    reason,
  });

  return { flagged: true, flagId: flag.id };
}

export async function getFlags(
  studentId: string,
): Promise<Array<{
  id: string;
  admissionId: string;
  fieldName: string;
  reason: string;
  status: string;
  createdAt: string;
}>> {
  const flags = await prisma.flag.findMany({
    where: { student_id: studentId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      admission_id: true,
      field_name: true,
      reason: true,
      status: true,
      created_at: true,
    },
  });

  return flags.map((f: typeof flags[number]) => ({
    id: f.id,
    admissionId: f.admission_id,
    fieldName: f.field_name,
    reason: f.reason,
    status: f.status,
    createdAt: f.created_at.toISOString(),
  }));
}
