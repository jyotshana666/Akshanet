import { z } from 'zod';

export const studentSchema = z.object({
  apaarId: z.string().regex(/^\d{12}$/, 'APAAR ID must be 12 digits'),
  name: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']),
  fatherName: z.string().max(200).optional(),
  motherName: z.string().max(200).optional(),
  nationality: z.string().max(50).default('Indian'),
  category: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS']).optional(),
  pwdStatus: z.boolean().default(false),
  bloodGroup: z.string().max(5).optional(),
  address: z.object({
    line1: z.string().max(500),
    line2: z.string().max(500).optional(),
    city: z.string().max(100),
    state: z.string().max(100),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  }).optional(),
});

export type StudentRecord = z.infer<typeof studentSchema>;
