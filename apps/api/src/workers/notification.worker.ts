import { redis } from '../lib/redis.js';
import { sendEmail, type EmailTemplate } from '../services/notification/email.service.js';
import { sendSms, type SmsTemplate } from '../services/notification/sms.service.js';
import type { QueueJob } from '../lib/queues.js';

const QUEUE_KEY = 'queue:notification';
const DEAD_LETTER_KEY = 'queue:notification:dead-letter';
const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 3;

const EMAIL_TYPES: Record<string, EmailTemplate> = {
  'student_verified': 'student-verify-reminder',
  'flag_raised': 'flag-raised',
  'flag_resolved': 'flag-resolved',
  'fraud_escalation': 'fraud-escalation-alert',
  'employer_access_revoked': 'employer-access-revoked',
  'employer_consent_request': 'employer-consent-request',
};

const SMS_TYPES: Record<string, SmsTemplate> = {
  'apaar_not_found': 'apaar-missing',
  'verify_reminder': 'verify-reminder',
  'consent_request': 'consent-request',
};

async function processJob(job: QueueJob, retryCount = 0): Promise<void> {
  const { type, ...data } = job.data as { type: string; [key: string]: unknown };

  let success = true;

  if (type in EMAIL_TYPES && data.email) {
    const result = await sendEmail(
      data.email as string,
      EMAIL_TYPES[type],
      data,
    );
    if (!result.sent) success = false;
  }

  if (type in SMS_TYPES && data.mobile) {
    const result = await sendSms(
      data.mobile as string,
      SMS_TYPES[type],
      data,
    );
    if (!result.sent) success = false;
  }

  if (!success && retryCount < MAX_RETRIES) {
    const delay = Math.pow(2, retryCount) * 1000;
    await new Promise(r => setTimeout(r, delay));
    await processJob(job, retryCount + 1);
  } else if (!success) {
    await redis.lpush(DEAD_LETTER_KEY, JSON.stringify({ ...job, failedAt: new Date().toISOString() }));
  }
}

export async function runNotificationWorker(signal?: AbortSignal): Promise<void> {
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
      // Dead letter handled in processJob
    }
  }
}
