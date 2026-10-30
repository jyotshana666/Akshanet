export const CHART_COLORS = {
  navy: '#1A3C6E',
  green: '#2D7D46',
  red: '#C0392B',
  amber: '#D4A017',
  cyan: '#2980B9',
  purple: '#7D3C98',
} as const;

export const REJECTION_REASON_CODES = [
  { code: 'APAAR_COVERAGE_LOW', label: 'APAAR Coverage Below Threshold' },
  { code: 'DUPLICATE_UNRESOLVED', label: 'Unresolved Duplicate Records' },
  { code: 'INTAKE_EXCEEDED', label: 'Intake Capacity Exceeded' },
  { code: 'FRAUD_ESCALATION_UNRESOLVED', label: 'Unresolved Fraud Escalation' },
  { code: 'STUDENT_VERIFICATION_INCOMPLETE', label: 'Student Verification Incomplete' },
  { code: 'DOCUMENT_MISSING', label: 'Missing Required Documents' },
  { code: 'DATA_QUALITY_POOR', label: 'Poor Data Quality' },
] as const;

export const REPORT_TYPES = [
  { key: 'STATE_WISE', label: 'State-Wise' },
  { key: 'PROGRAMME_WISE', label: 'Programme-Wise' },
  { key: 'INSTITUTION_WISE', label: 'Institution-Wise' },
  { key: 'TREND', label: 'Trend Analysis' },
] as const;

export const ANOMALY_TYPES = [
  'duplicate_apaar',
  'name_mismatch',
  'dob_mismatch',
  'cross_institution',
  'intake_overflow',
  'cgpa_outlier',
] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry',
  'Chandigarh', 'Jammu & Kashmir', 'Ladakh',
] as const;
