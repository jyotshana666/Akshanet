import { z } from 'zod';

export const institutionSchema = z.object({
  name: z.string().min(1).max(500),
  aicteId: z.string().min(1).max(50),
  state: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  region: z.string().max(50).optional(),
  approvedIntake: z.record(z.string(), z.number().int().nonnegative()),
});

export type InstitutionRecord = z.infer<typeof institutionSchema>;
