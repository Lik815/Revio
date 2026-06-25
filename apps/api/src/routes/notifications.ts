import { FastifyPluginAsync } from 'fastify';
import { getToken } from './auth-utils.js';


export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/notifications', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const notifications: {
      id: string;
      type: string;
      message: string;
      createdAt: Date;
      reviewStatus?: string;
      therapistId?: string;
      bookingId?: string;
      linkId?: string;
      practiceId?: string;
      actionLabel?: string;
    }[] = [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Resolve user (patient or therapist-via-user) ──────────────────────
    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { therapistProfile: true },
    });

    // ── Therapist path ─────────────────────────────────────────────────────
    const therapist =
      user?.therapistProfile ??
      (await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } }));

    if (therapist) {
      // Review status
      if (therapist.reviewStatus === 'APPROVED') {
        notifications.push({
          id: `review-${therapist.id}-approved`,
          type: 'PROFILE_APPROVED',
          message: 'Dein Profil wurde freigegeben.',
          createdAt: therapist.updatedAt,
          reviewStatus: therapist.reviewStatus,
          therapistId: therapist.id,
        });
      } else if (therapist.reviewStatus === 'CHANGES_REQUESTED') {
        notifications.push({
          id: `review-${therapist.id}-changes-requested`,
          type: 'PROFILE_CHANGES_REQUESTED',
          message: 'Für dein Profil wurden Änderungen angefordert.',
          createdAt: therapist.updatedAt,
          reviewStatus: therapist.reviewStatus,
          therapistId: therapist.id,
        });
      } else if (therapist.reviewStatus === 'REJECTED') {
        notifications.push({
          id: `review-${therapist.id}-rejected`,
          type: 'PROFILE_REJECTED',
          message: 'Dein Profil wurde aktuell nicht freigegeben.',
          createdAt: therapist.updatedAt,
          reviewStatus: therapist.reviewStatus,
          therapistId: therapist.id,
        });
      } else if (therapist.reviewStatus === 'SUSPENDED') {
        notifications.push({
          id: `review-${therapist.id}-suspended`,
          type: 'PROFILE_SUSPENDED',
          message: 'Dein Profil wurde vorübergehend pausiert.',
          createdAt: therapist.updatedAt,
          reviewStatus: therapist.reviewStatus,
          therapistId: therapist.id,
        });
      }

      // Booking requests received in the last 7 days — kept visible by time
      // window regardless of current status (matches the patient side,
      // which keys off respondedAt rather than status), so responding to a
      // request doesn't make its notification vanish.
      const recentBookingRequests = await fastify.prisma.bookingRequest.findMany({
        where: {
          therapistId: therapist.id,
          createdAt: { gte: sevenDaysAgo },
        },
        include: { patientUser: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      for (const b of recentBookingRequests) {
        const patientFullName = [b.patientUser?.firstName, b.patientUser?.lastName]
          .filter(Boolean)
          .join(' ');
        const name = b.patientName || patientFullName || 'Ein Patient';
        const date = b.createdAt.toLocaleDateString('de-DE');
        notifications.push({
          id: `booking-new-${b.id}`,
          type: 'NEW_BOOKING_REQUEST',
          message: `Neue Buchungsanfrage von ${name} (${date}).`,
          createdAt: b.createdAt,
          bookingId: b.id,
          actionLabel: 'Anfrage öffnen',
        });
      }

      // Practice invites for this therapist
      const invites = await (fastify.prisma as any).therapistPracticeLink.findMany({
        where: { therapistId: therapist.id, status: 'PROPOSED', initiatedBy: 'ADMIN' },
        include: { practice: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      for (const link of invites) {
        notifications.push({
          id: link.id,
          type: 'INVITE',
          message: `${link.practice.name} hat dich eingeladen, der Praxis beizutreten.`,
          createdAt: link.createdAt,
          linkId: link.id,
          practiceId: link.practice.id,
          actionLabel: 'Einladung öffnen',
        });
      }

      return { notifications };
    }

    // ── Patient path ───────────────────────────────────────────────────────
    if (user && !user.therapistProfile) {
      const recentBookings = await fastify.prisma.bookingRequest.findMany({
        where: {
          patientUserId: user.id,
          status: { in: ['CONFIRMED', 'DECLINED', 'CANCELLED'] },
          respondedAt: { gte: sevenDaysAgo },
        },
        orderBy: { respondedAt: 'desc' },
      });

      for (const b of recentBookings) {
        const respondedDate = b.respondedAt ?? b.createdAt;
        if (b.status === 'CONFIRMED') {
          const slotDate = (b.confirmedSlotAt ?? respondedDate).toLocaleDateString('de-DE');
          notifications.push({
            id: `booking-confirmed-${b.id}`,
            type: 'BOOKING_CONFIRMED',
            message: `Dein Termin am ${slotDate} wurde bestätigt. 🎉`,
            createdAt: respondedDate,
            bookingId: b.id,
            actionLabel: 'Termin öffnen',
          });
        } else if (b.status === 'DECLINED') {
          notifications.push({
            id: `booking-declined-${b.id}`,
            type: 'BOOKING_DECLINED',
            message: `Deine Terminanfrage konnte leider nicht bestätigt werden.`,
            createdAt: respondedDate,
            bookingId: b.id,
            actionLabel: 'Details öffnen',
          });
        } else if (b.status === 'CANCELLED') {
          notifications.push({
            id: `booking-cancelled-${b.id}`,
            type: 'BOOKING_CANCELLED',
            message: `Ein Termin wurde storniert.`,
            createdAt: respondedDate,
            bookingId: b.id,
            actionLabel: 'Details öffnen',
          });
        }
      }

      return { notifications };
    }

    return reply.unauthorized('Kein Token');
  });
};
