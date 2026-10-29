export const AICTE_REGION_STATES: Record<string, readonly string[]> = {
  NORTHERN: ['Delhi', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Punjab', 'Chandigarh', 'Uttarakhand'],
  SOUTHERN: ['Andhra Pradesh', 'Karnataka', 'Kerala', 'Tamil Nadu', 'Telangana', 'Puducherry', 'Lakshadweep'],
  EASTERN: ['Bihar', 'Jharkhand', 'Odisha', 'West Bengal', 'Andaman and Nicobar Islands'],
  WESTERN: ['Goa', 'Gujarat', 'Maharashtra', 'Dadra and Nagar Haveli and Daman and Diu'],
  CENTRAL: ['Chhattisgarh', 'Madhya Pradesh', 'Uttar Pradesh'],
  SOUTH_WESTERN: ['Karnataka', 'Kerala'],
  SOUTH_CENTRAL: ['Andhra Pradesh', 'Telangana'],
  NORTH_WESTERN: ['Rajasthan', 'Gujarat'],
} as const;

export const REJECTION_REASON_CODES: Record<string, string> = {
  APAAR_COVERAGE_LOW: 'Less than 100% of students have verified APAAR IDs',
  DUPLICATE_UNRESOLVED: 'One or more duplicate APAAR ID pairs remain unresolved',
  INTAKE_EXCEEDED: 'Student intake exceeds approved capacity for one or more programmes',
  FRAUD_ESCALATION_UNRESOLVED: 'One or more records flagged for fraud remain unresolved',
  STUDENT_VERIFICATION_INCOMPLETE: 'Not all students have verified their records',
  DOCUMENT_MISSING: 'Required supporting documents not submitted',
  DATA_QUALITY_POOR: 'Significant number of data mismatches or missing fields',
} as const;

export const APH_REFERENCES: Record<string, string> = {
  APAAR_COVERAGE_LOW: 'APH 2024-25, Section 3.2.1 — Student Identity Verification',
  DUPLICATE_UNRESOLVED: 'APH 2024-25, Section 3.2.3 — Duplicate Enrollment Prevention',
  INTAKE_EXCEEDED: 'APH 2024-25, Section 2.1.4 — Approved Intake Compliance',
  FRAUD_ESCALATION_UNRESOLVED: 'APH 2024-25, Section 5.1.2 — Fraud Detection and Resolution',
  STUDENT_VERIFICATION_INCOMPLETE: 'APH 2024-25, Section 3.2.2 — Student Self-Verification',
  DOCUMENT_MISSING: 'APH 2024-25, Section 4.3.1 — Document Submission Requirements',
  DATA_QUALITY_POOR: 'APH 2024-25, Section 3.1.5 — Data Quality Standards',
} as const;

export function getRegionForState(state: string): string | null {
  for (const [region, states] of Object.entries(AICTE_REGION_STATES)) {
    if (states.includes(state)) return region;
  }
  return null;
}
