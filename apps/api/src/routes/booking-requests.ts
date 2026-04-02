import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getToken } from './auth-utils.js';
import { getTherapistRequestabilityState } from '../utils/profile-completeness.js';
import { sendPushNotification } from '../utils/push-notify.js';

const createBookingRequestSchema = z.object({
  therapistId: z.string().min(1),
  patientName: z.string().min(2),
  patientEmail: z.string().email().optional(),
  patientPhone: z.string().min(6).optional(),
  preferredDays: z.array(z.string()).max(7).default([]),
  preferredTimeWindows: z.array(z.string()).max(4).default([]),
  message: z.string().max(1000).optional(),
  consentAccepted: z.literal(true),
}).refine(
  (data) => Boolean(data.patientEmail?.trim()) || Boolean(data.patientPhone?.trim()),
  { message: 'E-Mail oder Telefonnummer erforderlich' },
);

const updateBookingRequestSchema = z.object({
  confirmedSlotAt: z.string().trim().min(10).nullable().optional(),
});

const listSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED']).optional(),
});

const splitList = (value?: string | null) =>
  (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

const joinList = (items?: string[]) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean).join(', ');

async function resolveTherapistFromToken(fastify: any, token: string) {
  let therapist = null as any;

  const user = await fastify.prisma.user.findUnique({
    where: { sessionToken: token },
    include: {
      therapistProfile: {
        include: {
          links: {
            where: { status: 'CONFIRMED' },
            include: { practice: true },
          },
        },
      },
    },
  });
  if (user?.therapistProfile) therapist = user.therapistProfile;

  if (!therapist) {
    therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { practice: true },
        },
      },
    });
  }

  return therapist;
}

async function expirePendingRequests(fastify: any, therapistId?: string) {
  await fastify.prisma.bookingRequest.updateMany({
    where: {
      status: 'PENDING',
      responseDueAt: { lt: new Date() },
      ...(therapistId ? { therapistId } : {}),
    },
    data: { status: 'EXPIRED' },
  });
}

function serializeBookingRequest(request: any) {
  return {
    id: request.id,
    therapistId: request.therapistId,
    status: request.status,
    patientName: request.patientName,
    patientEmail: request.patientEmail ?? null,
    patientPhone: request.patientPhone ?? null,
    preferredDays: splitList(request.preferredDays),
    preferredTimeWindows: splitList(request.preferredTimeWindows),
    message: request.message ?? null,
    createdAt: new Date(request.createdAt).toISOString(),
    responseDueAt: new Date(request.responseDueAt).toISOString(),
    respondedAt: request.respondedAt ? new Date(request.respondedAt).toISOString() : null,
    confirmedSlotAt: request.confirmedSlotAt ? new Date(request.confirmedSlotAt).toISOString() : null,
  };
}

export const bookingRequestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/booking-requests', async (request, reply) => {
    const parsed = createBookingRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { id: parsed.data.therapistId },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { practice: true },
        },
      },
    });
    if (!therapist) return reply.notFound('Therapeut nicht gefunden');

    const requestability = getTherapistRequestabilityState(therapist, { links: therapist.links });
    if (!requestability.requestable) {
      return reply.forbidden('Therapeut ist aktuell nicht direkt anfragbar');
    }

    const bookingRequest = await fastify.prisma.bookingRequest.create({
      data: {
        therapistId: therapist.id,
        patientName: parsed.data.patientName.trim(),
        patientEmail: parsed.data.patientEmail?.trim() || null,
        patientPhone: parsed.data.patientPhone?.trim() || null,
        preferredDays: joinList(parsed.data.preferredDays),
        preferredTimeWindows: joinList(parsed.data.preferredTimeWindows),
        message: parsed.data.message?.trim() || null,
        consentAcceptedAt: new Date(),
        responseDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    if (therapist.expoPushToken) {
      await sendPushNotification({
        to: therapist.expoPushToken,
        title: 'Neue Anfrage 📋',
        body: `${parsed.data.patientName.trim()} möchte einen Termin vereinbaren.`,
        data: { screen: 'BookingRequests', requestId: bookingRequest.id },
      });
    }

    return reply.status(201).send({
      success: true,
      requestId: bookingRequest.id,
      status: bookingRequest.status,
      responseDueAt: bookingRequest.responseDueAt.toISOString(),
    });
  });

  fastify.get('/auth/booking-requests', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await resolveTherapistFromToken(fastify, token);
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    await expirePendingRequests(fastify, therapist.id);

    const requests = await fastify.prisma.bookingRequest.findMany({
      where: {
        therapistId: therapist.id,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    return { requests: requests.map(serializeBookingRequest) };
  });

  fastify.post('/auth/booking-requests/:id/confirm', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await resolveTherapistFromToken(fastify, token);
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const parsed = updateBookingRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const { id } = request.params as { id: string };
    await expirePendingRequests(fastify, therapist.id);

    const bookingRequest = await fastify.prisma.bookingRequest.findUnique({ where: { id } });
    if (!bookingRequest || bookingRequest.therapistId !== therapist.id) {
      return reply.notFound('Anfrage nicht gefunden');
    }
    if (bookingRequest.status !== 'PENDING') {
      return reply.conflict('Anfrage kann nicht mehr bestätigt werden');
    }

    const updated = await fastify.prisma.bookingRequest.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        respondedAt: new Date(),
        confirmedSlotAt: parsed.data.confirmedSlotAt ? new Date(parsed.data.confirmedSlotAt) : null,
      },
    });

    return {
      success: true,
      status: updated.status,
      confirmedSlotAt: updated.confirmedSlotAt ? updated.confirmedSlotAt.toISOString() : null,
    };
  });

  fastify.post('/auth/booking-requests/:id/decline', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await resolveTherapistFromToken(fastify, token);
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const { id } = request.params as { id: string };
    await expirePendingRequests(fastify, therapist.id);

    const bookingRequest = await fastify.prisma.bookingRequest.findUnique({ where: { id } });
    if (!bookingRequest || bookingRequest.therapistId !== therapist.id) {
      return reply.notFound('Anfrage nicht gefunden');
    }
    if (bookingRequest.status !== 'PENDING') {
      return reply.conflict('Anfrage kann nicht mehr abgelehnt werden');
    }

    const updated = await fastify.prisma.bookingRequest.update({
      where: { id },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    });

    return {
      success: true,
      status: updated.status,
    };
  });
};
