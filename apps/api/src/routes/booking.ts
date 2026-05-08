import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendPushNotification } from '../utils/push.js';

async function resolvePatient(fastify: FastifyInstance, token: string) {
  const user = await fastify.prisma.user.findUnique({
    where: { sessionToken: token },
  });
  if (!user || user.role !== 'patient') return null;
  return user;
}

async function resolveTherapist(fastify: FastifyInstance, token: string) {
  // Try User table first (role=therapist)
  const user = await fastify.prisma.user.findUnique({
    where: { sessionToken: token },
    include: { therapistProfile: true },
  });
  if (user?.role === 'therapist' && user.therapistProfile) {
    return user.therapistProfile;
  }
  // Legacy: Therapist.sessionToken
  const therapist = await fastify.prisma.therapist.findUnique({
    where: { sessionToken: token },
  });
  return therapist ?? null;
}

export async function bookingRoutes(fastify: FastifyInstance) {
  // POST /bookings — Patient creates a booking request
  fastify.post('/bookings', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can create booking requests' });

    const schema = z.object({
      therapistId: z.string(),
      preferredDays: z.string().min(1),
      preferredTimeWindows: z.string().min(1),
      message: z.string().optional(),
      consentAccepted: z.literal(true),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { therapistId, preferredDays, preferredTimeWindows, message, consentAccepted } = parsed.data;

    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.status(404).send({ error: 'Therapist not found' });
    if (therapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') {
      return reply.status(400).send({ error: 'This therapist does not accept booking requests' });
    }

    // Max 1 active request per patient+therapist
    const existing = await fastify.prisma.bookingRequest.findFirst({
      where: {
        patientUserId: patient.id,
        therapistId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (existing) {
      return reply.status(409).send({ error: 'You already have an active request with this therapist' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const booking = await fastify.prisma.bookingRequest.create({
      data: {
        therapistId,
        patientUserId: patient.id,
        status: 'PENDING',
        patientName: `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.email,
        patientEmail: patient.email,
        preferredDays,
        preferredTimeWindows,
        message,
        consentAcceptedAt: now,
        responseDueAt: expiresAt,
      },
    });

    // Push-Notification an Therapeuten
    if (therapist.expoPushToken) {
      const patientLabel = booking.patientName || booking.patientEmail || 'Ein Patient';
      sendPushNotification(
        therapist.expoPushToken,
        'Neue Terminanfrage',
        `${patientLabel} möchte einen Ersttermin buchen.`,
        { bookingId: booking.id, screen: 'bookings' },
      );
    }

    return reply.status(201).send({ id: booking.id, status: booking.status, expiresAt: booking.responseDueAt });
  });

  // GET /bookings/my — Patient sees their own requests
  fastify.get('/bookings/my', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can view their bookings' });

    // Mark expired requests
    await fastify.prisma.bookingRequest.updateMany({
      where: {
        patientUserId: patient.id,
        status: 'PENDING',
        responseDueAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { patientUserId: patient.id },
      include: {
        therapist: {
          select: {
            id: true,
            fullName: true,
            professionalTitle: true,
            city: true,
            photo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(bookings);
  });

  // GET /bookings/incoming — Therapist sees incoming requests
  fastify.get('/bookings/incoming', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can view incoming bookings' });

    // Mark expired requests
    await fastify.prisma.bookingRequest.updateMany({
      where: {
        therapistId: therapist.id,
        status: 'PENDING',
        responseDueAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(bookings);
  });

  // PATCH /bookings/:id/respond — Therapist confirms or declines
  fastify.patch('/bookings/:id/respond', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can respond to bookings' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({ where: { id } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your booking' });
    if (booking.status !== 'PENDING') return reply.status(400).send({ error: 'Booking is no longer pending' });

    const schema = z.discriminatedUnion('action', [
      z.object({ action: z.literal('CONFIRM'), confirmedSlotAt: z.string().datetime() }),
      z.object({ action: z.literal('DECLINE'), declinedReason: z.string().optional() }),
    ]);

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const now = new Date();
    if (parsed.data.action === 'CONFIRM') {
      const updated = await fastify.prisma.bookingRequest.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedSlotAt: new Date(parsed.data.confirmedSlotAt),
          respondedAt: now,
        },
      });

      // Push an Patient
      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        sendPushNotification(
          patientUser.expoPushToken,
          'Termin bestätigt 🎉',
          `${therapist.fullName} hat deinen Termin bestätigt.`,
          { bookingId: booking.id, screen: 'bookings' },
        );
      }

      return reply.send(updated);
    } else {
      const updated = await fastify.prisma.bookingRequest.update({
        where: { id },
        data: {
          status: 'DECLINED',
          declinedReason: parsed.data.declinedReason,
          respondedAt: now,
        },
      });

      // Push an Patient
      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        sendPushNotification(
          patientUser.expoPushToken,
          'Terminanfrage abgelehnt',
          `${therapist.fullName} konnte deinen Termin leider nicht bestätigen.`,
          { bookingId: booking.id, screen: 'bookings' },
        );
      }

      return reply.send(updated);
    }
  });

  // PATCH /bookings/:id/cancel — Patient cancels their own PENDING request
  fastify.patch('/bookings/:id/cancel', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can cancel booking requests' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({ where: { id } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.patientUserId !== patient.id) return reply.status(403).send({ error: 'Not your booking' });
    if (booking.status !== 'PENDING') return reply.status(400).send({ error: 'Only pending requests can be cancelled' });

    const updated = await fastify.prisma.bookingRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return reply.send(updated);
  });
}
