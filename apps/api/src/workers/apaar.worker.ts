import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { validateRecord } from '../services/apaar/validation.service.js';
import { checkDuplicate } from '../services/apaar/duplicate.service.js';
import { checkIntake } from '../services/apaar/intake.service.js';
import { mlScoringQueue } from '../lib/queues.js';
import type { QueueJob } from '../lib/queues.js';

const QUEUE_KEY = 'queue:apaar-validation';
const DELAYED_KEY = 'queue:apaar-validation:delayed';
const POLL_INTERVAL_MS = 5000;

async function promoteDelayed(): Promise<void> {
  const now = Date.now();
  const ready = await redis.zrangebyscore(DELAYED_KEY, 0, now);
  for (const item of ready) {
    await redis.lpush(QUEUE_KEY, item);
    await redis.zrem(DELAYED_KEY, item);
  }
}

async function processJob(job: QueueJob): Promise<void> {
  const { admissionId, retryCount } = job.data as {
    admissionId: string;
    apaarId: string;
    retryCount?: number;
  };

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId as string },
    select: {
      id: true,
      apaar_id: true,
      institution_id: true,
      programme_id: true,
      academic_year: true,
      upload_id: true,
      verification_status: true,
      student: { select: { name: true, date_of_birth: true, gender: true } },
    },
  });

  if (!admission) return;

  const isRetry = (retryCount as number | undefined) !== undefined && (retryCount as number) > 0;

  if (!isRetry && admission.verification_status === 'draft') {
    const { transition } = await import('../lib/stateMachine.js');
    await transition(prisma, admission.id, 'submitted' as any, 'system:apaar-worker', 'SYSTEM');
  }

  if (isRetry && admission.verification_status === 'apaar_retry_pending') {
    const { transition } = await import('../lib/stateMachine.js');
    await transition(prisma, admission.id, 'submitted' as any, 'system:apaar-worker', 'SYSTEM');
  }

  const validationResult = await validateRecord(admission, retryCount as number ?? 0);

  if (validationResult !== 'verified') return;

  await checkDuplicate(
    admission.apaar_id,
    admission.academic_year,
    admission.institution_id,
    admission.id,
  );

  const refreshed = await prisma.admission.findUnique({
    where: { id: admission.id },
    select: { verification_status: true },
  });

  if (refreshed?.verification_status === 'apaar_verified') {
    await checkIntake(
      admission.id,
      admission.institution_id,
      admission.programme_id,
      admission.academic_year,
    );

    if (admission.upload_id) {
      await mlScoringQueue.add(`ml-${admission.upload_id}`, {
        uploadId: admission.upload_id,
        institutionId: admission.institution_id,
      });
    }
  }
}

export async function runWorker(signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    await promoteDelayed();

    const item = await redis.rpop(QUEUE_KEY);
    if (!item) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    try {
      const job = JSON.parse(item) as QueueJob;
      await processJob(job);
    } catch {
      // Job failures are handled within processJob via retry mechanism
    }
  }
}
