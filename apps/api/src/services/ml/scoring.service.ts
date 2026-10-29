import { prisma } from '../../lib/prisma.js';
import { scoreBatch, type MlAdmissionRecord, type MlScoreResult } from '../../lib/mlClient.js';
import { transition } from '../../lib/stateMachine.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { notificationQueue } from '../../lib/queues.js';

const SYSTEM_ACTOR = 'system:ml-scorer';
const SYSTEM_ROLE = 'SYSTEM';

export async function scoreUpload(uploadId: string): Promise<{
  scored: number;
  escalated: number;
  watched: number;
  clean: number;
}> {
  const admissions = await prisma.admission.findMany({
    where: { upload_id: uploadId, verification_status: 'apaar_verified' },
    select: {
      id: true,
      apaar_id: true,
      institution_id: true,
      academic_year: true,
      created_at: true,
      programme: { select: { code: true } },
      upload: { select: { created_at: true } },
    },
  });

  if (admissions.length === 0) {
    return { scored: 0, escalated: 0, watched: 0, clean: 0 };
  }

  const batchTime = admissions[0].upload?.created_at?.toISOString() ?? new Date().toISOString();

  const mlRecords: MlAdmissionRecord[] = admissions.map((a: typeof admissions[number]) => ({
    admission_id: a.id,
    apaar_id: a.apaar_id,
    institution_id: a.institution_id,
    academic_year: a.academic_year,
    admission_date: a.created_at.toISOString(),
    programme: a.programme.code,
    batch_submission_time: batchTime,
  }));

  const results = await scoreBatch(mlRecords);
  return updateRiskScores(results);
}

export async function updateRiskScores(results: MlScoreResult[]): Promise<{
  scored: number;
  escalated: number;
  watched: number;
  clean: number;
}> {
  let escalated = 0;
  let watched = 0;
  let clean = 0;

  for (const result of results) {
    await prisma.admission.update({
      where: { id: result.admission_id },
      data: { apaar_risk_score: result.risk_score },
    });

    if (result.flag === 'FRAUD_ESCALATION') {
      await transition(prisma, result.admission_id, 'fraud_escalation', SYSTEM_ACTOR, SYSTEM_ROLE);

      await writeAuditEvent({
        actorId: SYSTEM_ACTOR,
        admissionId: result.admission_id,
        action: 'STATUS_CHANGE',
        targetTable: 'admissions',
        targetId: result.admission_id,
        newValue: {
          risk_score: result.risk_score,
          flag: 'FRAUD_ESCALATION',
          source: 'ml-scoring',
        },
      });

      await notificationQueue.add(`fraud-${result.admission_id}`, {
        type: 'fraud_escalation',
        admissionId: result.admission_id,
        riskScore: result.risk_score,
      });

      escalated++;
    } else if (result.flag === 'ANOMALY_WATCH') {
      await transition(prisma, result.admission_id, 'anomaly_watch', SYSTEM_ACTOR, SYSTEM_ROLE);
      watched++;
    } else {
      clean++;
    }
  }

  return { scored: results.length, escalated, watched, clean };
}
