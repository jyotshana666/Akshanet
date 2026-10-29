import { describe, it, expect } from 'vitest';
import { ADMISSION_STATES, VALID_TRANSITIONS, canTransition } from '../states.js';

describe('ADMISSION_STATES', () => {
  it('has exactly 17 states', () => {
    expect(Object.keys(ADMISSION_STATES)).toHaveLength(17);
  });

  it('includes all required states', () => {
    const required = [
      'draft', 'submitted', 'apaar_verified', 'data_mismatch',
      'apaar_not_found', 'duplicate_flagged', 'intake_exceeded',
      'apaar_retry_pending', 'fraud_escalation', 'anomaly_watch',
      'student_verified', 'student_flagged', 'submitted_to_aicte',
      'aicte_approved', 'rejected', 'transferred', 'withdrawn',
    ];
    const values = Object.values(ADMISSION_STATES);
    for (const state of required) {
      expect(values).toContain(state);
    }
  });
});

describe('VALID_TRANSITIONS', () => {
  it('covers every state', () => {
    for (const state of Object.values(ADMISSION_STATES)) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no transitions', () => {
    expect(VALID_TRANSITIONS.rejected).toEqual([]);
    expect(VALID_TRANSITIONS.transferred).toEqual([]);
    expect(VALID_TRANSITIONS.withdrawn).toEqual([]);
  });
});

describe('canTransition', () => {
  it('allows draft → submitted', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
  });

  it('denies draft → aicte_approved', () => {
    expect(canTransition('draft', 'aicte_approved')).toBe(false);
  });

  it('denies transition from terminal state', () => {
    expect(canTransition('rejected', 'draft')).toBe(false);
  });
});
