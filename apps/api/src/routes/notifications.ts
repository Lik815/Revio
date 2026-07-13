import { FastifyPluginAsync } from 'fastify';
import { getToken } from './auth-utils.js';

const RETENTION_DAYS = 30;

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Resolve user (patient or therapist-via-user) ─────────────────────────
  // Beide Lookups parallel — diese Route wird alle 30s gepollt, jeder
  // eingesparte sequenzielle DB-Roundtrip zählt.
  async function resolveRecipient(token: string) {
    const [user, legacyTherapist] = await Promise.all([
      fastify.prisma.user.findUnique({
        where: { sessionToken: token },
        include: { therapistProfile: true },
      }),
      fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }),
    ]);
    const therapist = user?.therapistProfile ?? legacyTherapist;
    if (therapist) return { kind: 'therapist' as const, therapistId: therapist.id };
    if (user && !user.therapistProfile) return { kind: 'patient' as const, userId: user.id };
    return null;
  }

  fastify.get('/notifications', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const recipient = await resolveRecipient(token);
    if (!recipient) return reply.unauthorized('Kein Token');

    const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const rows = await fastify.prisma.notification.findMany({
      where: {
        ...(recipient.kind === 'therapist'
          ? { therapistId: recipient.therapistId }
          : { userId: recipient.userId }),
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      createdAt: n.createdAt,
      read: n.readAt !== null,
      bookingId: n.bookingId ?? undefined,
      inquiryId: n.inquiryId ?? undefined,
      linkId: n.linkId ?? undefined,
      practiceId: n.practiceId ?? undefined,
      reviewStatus: n.reviewStatus ?? undefined,
      therapistId: n.therapistId ?? undefined,
      actionLabel: n.actionLabel ?? undefined,
    }));

    return { notifications };
  });

  // PATCH /notifications/:id/read — einzelne Mitteilung als gelesen markieren
  fastify.patch('/notifications/:id/read', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');
    const recipient = await resolveRecipient(token);
    if (!recipient) return reply.unauthorized('Kein Token');

    const { id } = request.params as { id: string };
    const result = await fastify.prisma.notification.updateMany({
      where: {
        id,
        ...(recipient.kind === 'therapist'
          ? { therapistId: recipient.therapistId }
          : { userId: recipient.userId }),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  });

  // PATCH /notifications/read-all — alle eigenen Mitteilungen als gelesen markieren
  fastify.patch('/notifications/read-all', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');
    const recipient = await resolveRecipient(token);
    if (!recipient) return reply.unauthorized('Kein Token');

    const result = await fastify.prisma.notification.updateMany({
      where: {
        ...(recipient.kind === 'therapist'
          ? { therapistId: recipient.therapistId }
          : { userId: recipient.userId }),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  });
};
