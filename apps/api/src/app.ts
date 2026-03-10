import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import prismaPlugin from './plugins/prisma.js';
import adminAuthPlugin from './plugins/admin-auth.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { registerRoutes } from './routes/register.js';
import { adminRoutes } from './routes/admin.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(adminAuthPlugin);

  await app.register(healthRoutes);
  await app.register(searchRoutes);
  await app.register(registerRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
