import { redis } from '../lib/redis.js';
import { scoreUpload } from '../services/ml/scoring.service.js';
import { notificationQueue } from '../lib/queues.js';
import { prisma } from '../lib/prisma.js';
import type { QueueJob } from '../lib/queues.js';

const QUEUE_KEY = 'queue:ml-scoring';
const POLL_INTERVAL_MS = 5000;

async function processJob(job: QueueJob): Promise<void> {
  const { uploadId, institutionId } = job.data as {
    uploadId: string;
    institutionId: string;
  };

  const result = await scoreUpload(uploadId);

  if (result.escalated > 0) {
    const escalatedRecords = await prisma.admission.findMany({
      where: {
        upload_id: uploadId,
        verification_status: 'fraud_escalation',
      },
      select: { id: true },
    });

    for (const record of escalatedRecords) {
      await notificationQueue.add(`fraud-notify-${record.id}`, {
        type: 'fraud_alert_institution',
        admissionId: record.id,
        uploadId,
        institutionId,
      });
    }
  }
}

export async function runMlWorker(signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    const item = await redis.rpop(QUEUE_KEY);
    if (!item) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    try {
      const job = JSON.parse(item) as QueueJob;
      await processJob(job);
    } catch {
      // Job failures logged via audit in scoring service
    }
  }
}
