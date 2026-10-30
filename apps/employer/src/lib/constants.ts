export const CONSENT_PURPOSES = [
  { value: 'employment_verification', label: 'Employment Verification' },
  { value: 'background_check', label: 'Background Check' },
  { value: 'credential_verification', label: 'Credential Verification' },
  { value: 'internship_offer', label: 'Internship Offer' },
  { value: 'campus_placement', label: 'Campus Placement' },
] as const;

export const CONSENT_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[keyof typeof CONSENT_STATUSES];

export const CONSENT_STATUS_COLORS: Record<ConsentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600',
  revoked: 'bg-orange-100 text-orange-800',
};
