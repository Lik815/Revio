import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REVIO_ADMIN_TOKEN: z.string().min(1),
  REVIO_ADMIN_EMAIL: z.string().trim().email().default('admin@revio.de'),
  REVIO_ADMIN_PASSWORD: z.string().trim().min(6).default('admin123'),
  RESEND_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default('https://my-revio.de'),
});

export function getEnv() {
  return envSchema.parse(process.env);
}
