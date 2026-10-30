export const ADMISSION_STATES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APAAR_VERIFIED: 'apaar_verified',
  DATA_MISMATCH: 'data_mismatch',
  APAAR_NOT_FOUND: 'apaar_not_found',
  DUPLICATE_FLAGGED: 'duplicate_flagged',
  INTAKE_EXCEEDED: 'intake_exceeded',
  APAAR_RETRY_PENDING: 'apaar_retry_pending',
  FRAUD_ESCALATION: 'fraud_escalation',
  ANOMALY_WATCH: 'anomaly_watch',
  STUDENT_VERIFIED: 'student_verified',
  STUDENT_FLAGGED: 'student_flagged',
  SUBMITTED_TO_AICTE: 'submitted_to_aicte',
  AICTE_APPROVED: 'aicte_approved',
  REJECTED: 'rejected',
  TRANSFERRED: 'transferred',
  WITHDRAWN: 'withdrawn',
} as const;

export type AdmissionState = (typeof ADMISSION_STATES)[keyof typeof ADMISSION_STATES];

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  apaar_verified: 'bg-cyan-100 text-cyan-700',
  data_mismatch: 'bg-yellow-100 text-yellow-700',
  apaar_not_found: 'bg-yellow-100 text-yellow-700',
  duplicate_flagged: 'bg-orange-100 text-orange-700',
  intake_exceeded: 'bg-red-100 text-red-700',
  apaar_retry_pending: 'bg-yellow-100 text-yellow-700',
  fraud_escalation: 'bg-red-100 text-red-700',
  anomaly_watch: 'bg-orange-100 text-orange-700',
  student_verified: 'bg-green-100 text-green-700',
  student_flagged: 'bg-orange-100 text-orange-700',
  submitted_to_aicte: 'bg-blue-100 text-blue-700',
  aicte_approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  transferred: 'bg-purple-100 text-purple-700',
  withdrawn: 'bg-gray-100 text-gray-500',
};

export const AKSHANET_FIELDS = [
  { key: 'apaarId', label: 'APAAR ID', required: true },
  { key: 'studentName', label: 'Student Name', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'programmeCode', label: 'Programme Code', required: true },
  { key: 'academicYear', label: 'Academic Year', required: true },
  { key: 'seatType', label: 'Seat Type', required: false },
  { key: 'quotaType', label: 'Quota Type', required: false },
  { key: 'admissionMode', label: 'Admission Mode', required: false },
  { key: 'feeCategory', label: 'Fee Category', required: false },
  { key: 'feeAmount', label: 'Fee Amount', required: false },
  { key: 'admissionDate', label: 'Admission Date', required: false },
  { key: 'rollNumber', label: 'Roll Number', required: false },
  { key: 'enrollmentNumber', label: 'Enrollment Number', required: false },
] as const;

export const NOTIFICATION_TEMPLATES = [
  { key: 'verify-reminder', label: 'Verification Reminder' },
  { key: 'flag-resolved', label: 'Flag Resolved' },
  { key: 'general', label: 'General Notification' },
] as const;
