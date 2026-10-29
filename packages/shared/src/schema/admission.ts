import { z } from 'zod';
import { ADMISSION_STATES } from '../states.js';

const admissionStateValues = Object.values(ADMISSION_STATES) as [string, ...string[]];

export const admissionSchema = z.object({
  apaarId: z.string().regex(/^\d{12}$/, 'APAAR ID must be 12 digits'),
  studentName: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']),
  programmeCode: z.string().min(1).max(50),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be YYYY-YY'),
  seatType: z.string().min(1).max(30).optional(),
  quotaType: z.string().min(1).max(30).optional(),
  admissionMode: z.string().min(1).max(30).optional(),
  feeCategory: z.string().min(1).max(30).optional(),
  feeAmount: z.number().nonnegative().optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rollNumber: z.string().max(50).optional(),
  enrollmentNumber: z.string().max(50).optional(),
});

export const admissionRowSchema = admissionSchema;

export type AdmissionRecord = z.infer<typeof admissionSchema>;

export const REQUIRED_ADMISSION_FIELDS = [
  'apaarId',
  'studentName',
  'dateOfBirth',
  'gender',
  'programmeCode',
  'academicYear',
] as const;
