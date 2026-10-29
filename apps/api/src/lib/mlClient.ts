import { config } from '../config.js';

export interface MlAdmissionRecord {
  admission_id: string;
  apaar_id: string;
  institution_id: string;
  academic_year: string;
  seat_type?: string;
  admission_date: string;
  programme: string;
  device_fingerprint?: string;
  address_hash?: string;
  batch_submission_time: string;
}

export interface MlScoreResult {
  admission_id: string;
  risk_score: number;
  flag: 'FRAUD_ESCALATION' | 'ANOMALY_WATCH' | 'CLEAN';
}

export async function scoreBatch(
  records: MlAdmissionRecord[],
): Promise<MlScoreResult[]> {
  if (records.length === 0) return [];

  const url = `${config.ML_SERVICE_URL}/score`;
  const body = JSON.stringify({ records });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      const data = (await response.json()) as { results: MlScoreResult[] };
      return data.results;
    } catch {
      if (attempt === 1) {
        return records.map(r => ({
          admission_id: r.admission_id,
          risk_score: 0,
          flag: 'CLEAN' as const,
        }));
      }
    }
  }

  return records.map(r => ({
    admission_id: r.admission_id,
    risk_score: 0,
    flag: 'CLEAN' as const,
  }));
}
