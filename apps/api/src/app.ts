import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prismaPlugin from './plugins/prisma.js';
import adminAuthPlugin from './plugins/admin-auth.js';
import rateLimitPlugin from './plugins/rateLimitPlugin.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { registerRoutes } from './routes/register.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/upload.js';
import { configRoutes } from './routes/config.js';
import { bookingRoutes } from './routes/booking.js';
import { reviewRoutes } from './routes/reviews.js';
import { feedbackRoutes } from './routes/feedback.js';
import { notificationRoutes } from './routes/notifications.js';
import { materializeWorkingHours } from './utils/working-hours.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 1 * 1024 * 1024 }); // 1MB JSON body limit

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max image
  await app.register(staticPlugin, {
    root: join(__dirname, '../storage/public/uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
  await app.register(prismaPlugin);
  await app.register(adminAuthPlugin);
  await app.register(rateLimitPlugin);

  await app.register(healthRoutes);
  await app.register(configRoutes);
  await app.register(searchRoutes);
  await app.register(registerRoutes);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(authRoutes);
  await app.register(uploadRoutes);
  await app.register(bookingRoutes);
  await app.register(reviewRoutes);
  await app.register(feedbackRoutes);
  await app.register(notificationRoutes);

  // ── Scheduled expiry: release slots from stale PENDING bookings every 5 min
  app.addHook('onReady', () => {
    const runExpiry = async () => {
      try {
        const stale = await app.prisma.bookingRequest.findMany({
          where: { status: 'PENDING', responseDueAt: { lt: new Date() } },
          select: { id: true, slotId: true },
        });
        if (stale.length === 0) return;
        await app.prisma.$transaction([
          app.prisma.bookingRequest.updateMany({
            where: { id: { in: stale.map((b) => b.id) } },
            data: { status: 'EXPIRED', slotId: null },
          }),
          ...stale
            .filter((b) => b.slotId)
            .map((b) =>
              app.prisma.therapistSlot.update({
                where: { id: b.slotId! },
                data: { status: 'AVAILABLE' },
              }),
            ),
        ]);
        app.log.info(`[expiry] Expired ${stale.length} stale booking(s)`);
      } catch (err) {
        app.log.error({ err }, '[expiry] Failed to expire stale bookings');
      }
    };

    setInterval(runExpiry, 5 * 60 * 1000);
  });

  // ── Scheduled materialization: keep each therapist's working-hours rolling
  // window topped up as time passes (PUT /therapist/working-hours already
  // materializes synchronously on save — this just extends the window
  // forward for rules saved long ago).
  app.addHook('onReady', () => {
    const runWorkingHoursTopUp = async () => {
      try {
        const active = await app.prisma.therapistWorkingHoursRule.findMany({
          where: { isActive: true },
          select: { therapistId: true },
          distinct: ['therapistId'],
        });
        for (const { therapistId } of active) {
          await materializeWorkingHours(app, therapistId);
        }
        if (active.length > 0) {
          app.log.info(`[working-hours] Topped up rolling window for ${active.length} therapist(s)`);
        }
      } catch (err) {
        app.log.error({ err }, '[working-hours] Failed to top up rolling window');
      }
    };

    setInterval(runWorkingHoursTopUp, 6 * 60 * 60 * 1000);
  });

  return app;
}
