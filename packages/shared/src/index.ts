export { ADMISSION_STATES, VALID_TRANSITIONS, canTransition } from './states.js';
export type { AdmissionState } from './states.js';
export {
  SEAT_TYPES, AICTE_REGIONS, PROGRAMMES, QUOTA_TYPES, ADMISSION_MODES, FEE_CATEGORIES,
} from './constants.js';
export type {
  SeatType, AicteRegion, Programme, QuotaType, AdmissionMode, FeeCategory,
} from './constants.js';
export {
  studentSchema, admissionSchema, admissionRowSchema, institutionSchema,
  REQUIRED_ADMISSION_FIELDS,
} from './schema/index.js';
export type { StudentRecord, AdmissionRecord, InstitutionRecord } from './schema/index.js';
