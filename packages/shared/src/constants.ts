export const SEAT_TYPES = [
  'GENERAL',
  'OBC',
  'SC',
  'ST',
  'EWS',
  'NRI',
  'MANAGEMENT',
  'LATERAL_ENTRY',
] as const;
export type SeatType = (typeof SEAT_TYPES)[number];

export const AICTE_REGIONS = [
  'NORTHERN',
  'SOUTHERN',
  'EASTERN',
  'WESTERN',
  'CENTRAL',
  'SOUTH_WESTERN',
  'SOUTH_CENTRAL',
  'NORTH_WESTERN',
] as const;
export type AicteRegion = (typeof AICTE_REGIONS)[number];

export const PROGRAMMES = [
  'BTECH',
  'MTECH',
  'MBA',
  'MCA',
  'BPHARM',
  'MPHARM',
  'BARCH',
  'DIPLOMA',
  'BHMCT',
] as const;
export type Programme = (typeof PROGRAMMES)[number];

export const QUOTA_TYPES = [
  'AI',       // All India
  'STATE',
  'MANAGEMENT',
  'NRI',
  'LATERAL',
  'TFW',      // Tuition Fee Waiver
] as const;
export type QuotaType = (typeof QUOTA_TYPES)[number];

export const ADMISSION_MODES = [
  'COUNSELLING',
  'MANAGEMENT',
  'SPOT',
  'LATERAL',
  'DIRECT',
] as const;
export type AdmissionMode = (typeof ADMISSION_MODES)[number];

export const FEE_CATEGORIES = [
  'TUITION',
  'HOSTEL',
  'EXAM',
  'DEVELOPMENT',
  'LIBRARY',
  'LAB',
  'OTHER',
] as const;
export type FeeCategory = (typeof FEE_CATEGORIES)[number];
