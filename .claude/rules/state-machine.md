# State Machine Rules

Every admission record has a `verification_status` field.
The state machine in `/packages/shared/src/states.ts` defines all valid transitions.
The enforcer in `/apps/api/src/lib/stateMachine.ts` throws on illegal transitions.

## States (complete list)

```typescript
export const ADMISSION_STATES = {
  DRAFT:               'draft',
  SUBMITTED:           'submitted',
  APAAR_VERIFIED:      'apaar_verified',
  DATA_MISMATCH:       'data_mismatch',
  APAAR_NOT_FOUND:     'apaar_not_found',
  DUPLICATE_FLAGGED:   'duplicate_flagged',
  INTAKE_EXCEEDED:     'intake_exceeded',
  APAAR_RETRY_PENDING: 'apaar_retry_pending',
  FRAUD_ESCALATION:    'fraud_escalation',
  ANOMALY_WATCH:       'anomaly_watch',
  STUDENT_VERIFIED:    'student_verified',
  STUDENT_FLAGGED:     'student_flagged',
  SUBMITTED_TO_AICTE:  'submitted_to_aicte',
  AICTE_APPROVED:      'aicte_approved',
  REJECTED:            'rejected',
  TRANSFERRED:         'transferred',
  WITHDRAWN:           'withdrawn',
} as const
