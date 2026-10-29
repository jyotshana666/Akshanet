import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config.js', () => ({
  config: { ML_SERVICE_URL: 'http://ml-service:8000', NODE_ENV: 'test' },
}));

import { scoreBatch, type MlAdmissionRecord } from '../mlClient.js';

const makeRecord = (id = 'adm-1'): MlAdmissionRecord => ({
  admission_id: id,
  apaar_id: '123456789012',
  institution_id: 'inst-1',
  academic_year: '2025-26',
  admission_date: '2025-06-15T10:00:00Z',
  programme: 'BTECH-CSE',
  batch_submission_time: '2025-06-15T09:00:00Z',
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scoreBatch', () => {
  it('returns scores from ML service', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { admission_id: 'adm-1', risk_score: 0.2, flag: 'CLEAN' },
        ],
      }),
    });

    const results = await scoreBatch([makeRecord()]);
    expect(results).toHaveLength(1);
    expect(results[0].flag).toBe('CLEAN');
    expect(results[0].risk_score).toBe(0.2);
  });

  it('returns CLEAN for all when ML service is down', async () => {
    fetchMock.mockRejectedValue(new Error('Connection refused'));

    const results = await scoreBatch([makeRecord('a1'), makeRecord('a2')]);
    expect(results).toHaveLength(2);
    expect(results[0].flag).toBe('CLEAN');
    expect(results[1].flag).toBe('CLEAN');
    expect(results[0].risk_score).toBe(0);
  });

  it('retries once on failure then falls back', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ admission_id: 'adm-1', risk_score: 0.8, flag: 'FRAUD_ESCALATION' }],
        }),
      });

    const results = await scoreBatch([makeRecord()]);
    expect(results[0].flag).toBe('FRAUD_ESCALATION');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty array for empty input', async () => {
    const results = await scoreBatch([]);
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
