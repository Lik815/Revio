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
import { scheduleRoutes } from './routes/schedule.js';
import { inquiryRoutes } from './routes/inquiry.js';
import { matchRoutes } from './routes/match.js';

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
  await app.register(scheduleRoutes);
  await app.register(inquiryRoutes);
  await app.register(matchRoutes);

  // Scheduled expiry: mark stale PENDING bookings as EXPIRED every 5 min.
  // Im dynamischen Buchungssystem gibt es keine TherapistSlot-Statusänderung
  // mehr — der Zeitraum wird automatisch frei, sobald Status != PENDING|CONFIRMED.
  app.addHook('onReady', () => {
    const runExpiry = async () => {
      const now = new Date();
      try {
        // BookingRequest-Expiry (Legacy)
        const stale = await app.prisma.bookingRequest.findMany({
          where: { status: 'PENDING', responseDueAt: { lt: now } },
          select: { id: true },
        });
        if (stale.length > 0) {
          await app.prisma.bookingRequest.updateMany({
            where: { id: { in: stale.map((b) => b.id) } },
            data: { status: 'EXPIRED' },
          });
          app.log.info(`[expiry] Expired ${stale.length} stale booking(s)`);
        }

        // Inquiry-Expiry (Phase 2 — SLA 2 Werktage)
        const staleInquiries = await app.prisma.inquiry.findMany({
          where: { status: { in: ['SENT', 'SEEN'] }, responseDueAt: { lt: now } },
          select: { id: true },
        });
        if (staleInquiries.length > 0) {
          await app.prisma.inquiry.updateMany({
            where: { id: { in: staleInquiries.map((i) => i.id) } },
            data: { status: 'EXPIRED' },
          });
          app.log.info(`[expiry] Expired ${staleInquiries.length} stale inquiry/ies`);
        }

        // Inquiry-Reminder nach 1 Werktag (noch nicht gesendet)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        await app.prisma.inquiry.updateMany({
          where: {
            status: { in: ['SENT', 'SEEN'] },
            createdAt: { lt: oneDayAgo },
            reminderSentAt: null,
            responseDueAt: { gt: now },
          },
          data: { reminderSentAt: now },
        });
      } catch (err) {
        app.log.error({ err }, '[expiry] Failed to run expiry/reminder jobs');
      }
    };

    setInterval(runExpiry, 5 * 60 * 1000);
  });

  return app;
}
