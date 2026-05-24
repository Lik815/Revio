import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REVIO_ADMIN_TOKEN: z.string().min(1),
  REVIO_ADMIN_EMAIL: z.string().trim().email().default('admin@revio.de'),
  REVIO_ADMIN_PASSWORD: z.string().trim().min(6).default('admin123'),
  CLIENT_URL: z.string().default('https://revio.app'),
  NODE_ENV: z.string().default('production'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

export function getEnv() {
  return envSchema.parse(process.env);
}
