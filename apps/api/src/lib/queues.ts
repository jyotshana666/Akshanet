import { redis } from './redis.js';

export interface QueueJob {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface Queue {
  name: string;
  add(jobId: string, data: Record<string, unknown>): Promise<void>;
}

function createQueue(name: string): Queue {
  const queueKey = `queue:${name}`;

  return {
    name,
    async add(jobId: string, data: Record<string, unknown>): Promise<void> {
      const job: QueueJob = {
        id: jobId,
        data,
        createdAt: new Date().toISOString(),
      };
      await redis.lpush(queueKey, JSON.stringify(job));
    },
  };
}

export const apaarValidationQueue = createQueue('apaar-validation');
export const notificationQueue = createQueue('notification');

export const QUEUES = {
  'apaar-validation': apaarValidationQueue,
  'notification': notificationQueue,
} as const;
