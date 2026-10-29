import { z } from 'zod';

export const sendOtpEmailSchema = z.object({
  email: z.string().email(),
});

export const sendOtpMobileSchema = z.object({
  mobile: z.string().regex(/^\d{10}$/, 'Must be a 10-digit mobile number'),
});

export const verifyOtpEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit OTP'),
});

export const verifyOtpMobileSchema = z.object({
  mobile: z.string().regex(/^\d{10}$/, 'Must be a 10-digit mobile number'),
  code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit OTP'),
});

export const studentRegisterSchema = z.object({
  apaarId: z.string().regex(/^\d{12}$/, 'APAAR ID must be 12 digits'),
  name: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  mobile: z.string().regex(/^\d{10}$/, 'Must be a 10-digit mobile number'),
  collegeEmail: z.string().email(),
});
