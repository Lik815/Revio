import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REVIO_ADMIN_TOKEN: z.string().min(1),
});

export function getEnv() {
  return envSchema.parse(process.env);
}
