import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REVIO_ADMIN_TOKEN: z.string().min(1),
  REVIO_ADMIN_EMAIL: z.string().email().default('admin@revio.de'),
  REVIO_ADMIN_PASSWORD: z.string().min(6).default('admin123'),
});

export function getEnv() {
  return envSchema.parse(process.env);
}
