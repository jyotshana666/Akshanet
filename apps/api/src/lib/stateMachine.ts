import { writeAuditEvent } from './audit.js';
import type { PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['submitted'],
  submitted: ['apaar_verified', 'data_mismatch', 'apaar_not_found', 'apaar_retry_pending', 'duplicate_flagged', 'intake_exceeded', 'withdrawn'],
  apaar_verified: ['duplicate_flagged', 'intake_exceeded', 'anomaly_watch', 'student_verified', 'fraud_escalation', 'withdrawn'],
  data_mismatch: ['apaar_retry_pending', 'rejected', 'withdrawn'],
  apaar_not_found: ['apaar_retry_pending', 'rejected', 'withdrawn'],
  duplicate_flagged: ['fraud_escalation', 'apaar_verified', 'rejected', 'withdrawn'],
  intake_exceeded: ['rejected', 'withdrawn'],
  apaar_retry_pending: ['submitted', 'withdrawn'],
  fraud_escalation: ['rejected', 'apaar_verified'],
  anomaly_watch: ['student_verified', 'fraud_escalation', 'student_flagged', 'withdrawn'],
  student_verified: ['submitted_to_aicte', 'withdrawn'],
  student_flagged: ['student_verified', 'rejected', 'withdrawn'],
  submitted_to_aicte: ['aicte_approved', 'rejected'],
  aicte_approved: ['transferred'],
  rejected: [],
  transferred: [],
  withdrawn: [],
};

export function canTransition(
  from: string,
  to: string,
): { ok: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[from];

  if (!allowed) {
    return { ok: false, error: `Unknown state: ${from}` };
  }

  if (!allowed.includes(to)) {
    return { ok: false, error: `Transition ${from} → ${to} is not allowed` };
  }

  return { ok: true };
}

export async function transition(
  tx: TxClient,
  admissionId: string,
  toState: string,
  actorId: string,
  actorRole: string,
): Promise<void> {
  const admission = await tx.admission.findUniqueOrThrow({
    where: { id: admissionId },
    select: { verification_status: true, institution_id: true },
  });

  const fromState = admission.verification_status as string;
  const check = canTransition(fromState, toState);

  if (!check.ok) {
    await writeAuditEvent({
      actorId,
      institutionId: admission.institution_id,
      admissionId,
      action: 'STATUS_CHANGE',
      targetTable: 'admissions',
      targetId: admissionId,
      oldValue: { status: fromState, attempted: toState },
      newValue: { error: check.error },
    });
    throw new Error(check.error);
  }

  await tx.admission.update({
    where: { id: admissionId },
    data: { verification_status: toState as any },
  });

  await writeAuditEvent({
    actorId,
    institutionId: admission.institution_id,
    admissionId,
    action: 'STATUS_CHANGE',
    targetTable: 'admissions',
    targetId: admissionId,
    oldValue: { status: fromState },
    newValue: { status: toState, role: actorRole },
  });
}
