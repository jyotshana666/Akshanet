import { redis } from './redis.js';

export interface QueueJob {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface Queue {
  name: string;
  add(jobId: string, data: Record<string, unknown>): Promise<void>;
  addDelayed(jobId: string, data: Record<string, unknown>, delayMs: number): Promise<void>;
}

function createQueue(name: string): Queue {
  const queueKey = `queue:${name}`;
  const delayedKey = `queue:${name}:delayed`;

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
    async addDelayed(jobId: string, data: Record<string, unknown>, delayMs: number): Promise<void> {
      const job: QueueJob = {
        id: jobId,
        data,
        createdAt: new Date().toISOString(),
      };
      const executeAt = Date.now() + delayMs;
      await redis.zadd(delayedKey, executeAt, JSON.stringify(job));
    },
  };
}

export const apaarValidationQueue = createQueue('apaar-validation');
export const notificationQueue = createQueue('notification');
export const mlScoringQueue = createQueue('ml-scoring');

export const QUEUES = {
  'apaar-validation': apaarValidationQueue,
  'notification': notificationQueue,
  'ml-scoring': mlScoringQueue,
} as const;
