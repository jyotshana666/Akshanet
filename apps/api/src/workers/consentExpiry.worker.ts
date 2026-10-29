import { expireOutdatedRequests } from '../services/employer/consentRequest.service.js';
import { consentExpiryQueue } from '../lib/queues.js';

const INTERVAL_MS = 5 * 60 * 1000;

export async function processConsentExpiry(): Promise<void> {
  const expired = await expireOutdatedRequests();
  if (expired > 0) {
    console.log(`[consent-expiry] Expired ${expired} consent requests`);
  }
}

export function startConsentExpiryWorker(): void {
  const run = async () => {
    try {
      await processConsentExpiry();
    } catch (err) {
      console.error('[consent-expiry] Worker error:', (err as Error).message);
    }
    await consentExpiryQueue.addDelayed('expiry-check', {}, INTERVAL_MS);
  };

  setInterval(() => {
    run().catch(() => {});
  }, INTERVAL_MS);

  run().catch(() => {});
}
