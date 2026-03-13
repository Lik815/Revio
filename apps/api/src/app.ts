import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import prismaPlugin from './plugins/prisma.js';
import adminAuthPlugin from './plugins/admin-auth.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { registerRoutes } from './routes/register.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { practiceAuthRoutes } from './routes/practice-auth.js';
import { practiceRoutes } from './routes/practice.js';

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 }); // 10MB for photo uploads

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(adminAuthPlugin);

  await app.register(healthRoutes);
  await app.register(searchRoutes);
  await app.register(registerRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(authRoutes);
  await app.register(practiceAuthRoutes);
  await app.register(practiceRoutes);

  return app;
}
