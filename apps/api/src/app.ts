import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prismaPlugin from './plugins/prisma.js';
import adminAuthPlugin from './plugins/admin-auth.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { registerRoutes } from './routes/register.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/upload.js';
import { configRoutes } from './routes/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1 * 1024 * 1024 }); // 1MB JSON body limit

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max image
  await app.register(staticPlugin, {
    root: join(__dirname, '../uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
  await app.register(prismaPlugin);
  await app.register(adminAuthPlugin);

  await app.register(healthRoutes);
  await app.register(configRoutes);
  await app.register(searchRoutes);
  await app.register(registerRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(authRoutes);
  await app.register(uploadRoutes);

  return app;
}
