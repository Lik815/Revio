import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const TEST_DB = './prisma/test.db';

export async function setup() {
  process.env.DATABASE_URL = `file:${TEST_DB}`;
  process.env.REVIO_ADMIN_TOKEN = 'test-token';

  // Remove stale test DB so migration starts fresh
  if (existsSync(TEST_DB)) rmSync(TEST_DB);

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: 'pipe',
  });
}

export async function teardown() {
  if (existsSync(TEST_DB)) rmSync(TEST_DB);
}
