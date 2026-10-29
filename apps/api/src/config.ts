import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  MINIO_ENDPOINT: z.string().url(),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('akshanet-uploads'),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  APAAR_API_URL: z.string().url().default('http://localhost:9999'),
  APAAR_API_KEY: z.string().min(1).default('mock-key'),
  APAAR_MOCK: z.string().default('false').transform(v => v === 'true'),

  ML_SERVICE_URL: z.string().url(),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@akshanet.in'),

  TWILIO_SID: z.string().default(''),
  TWILIO_TOKEN: z.string().default(''),
  TWILIO_FROM: z.string().default(''),

  API_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', formatted);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const config = loadConfig();
