import { buildApp } from './app.js';
import { getEnv } from './env.js';

const app = await buildApp();
const env = getEnv();

try {
  await app.listen({ host: '0.0.0.0', port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
