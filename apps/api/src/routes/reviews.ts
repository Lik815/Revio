import { FastifyInstance } from 'fastify';
import { z } from 'zod';

async function resolvePatient(fastify: FastifyInstance, token: string) {
  const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
  if (!user || user.role !== 'patient') return null;
  return user;
}

async function resolveAnyAuthenticatedActor(fastify: FastifyInstance, token: string) {
  const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
  if (user) return true;
  const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
  return Boolean(therapist);
}

function deriveDisplayName(firstName: string | null, lastName: string | null) {
  const first = firstName?.trim();
  const lastInitial = lastName?.trim()?.[0];
  if (first && lastInitial) return `${first} ${lastInitial}.`;
  if (first) return first;
  return 'Patient';
}

function isBookingReviewable(booking: {
  status: string;
  confirmedSlotAt: Date | null;
  slot: { startsAt: Date } | null;
}) {
  if (booking.status !== 'CONFIRMED') return false;
  const appointmentAt = booking.slot?.startsAt ?? booking.confirmedSlotAt;
  if (!appointmentAt) return false;
  return appointmentAt.getTime() < Date.now();
}

export async function reviewRoutes(fastify: FastifyInstance) {

  // GET /therapists/:id/reviews — Bewertungen eines Therapeuten (nur für eingeloggte Nutzer)
  fastify.get('/therapists/:id/reviews', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const isAuthenticated = await resolveAnyAuthenticatedActor(fastify, token);
    if (!isAuthenticated) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };

    const reviews = await fastify.prisma.therapistReview.findMany({
      where: { therapistId: id, status: 'PUBLISHED' },
      include: { patientUser: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const count = reviews.length;
    const avgRating = count > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / count
      : null;

    return reply.send({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        patientName: deriveDisplayName(r.patientUser.firstName, r.patientUser.lastName),
      })),
      summary: { avgRating, count },
    });
  });

  // GET /bookings/:id/review-eligibility — Darf der Patient diese Buchung bewerten?
  fastify.get('/bookings/:id/review-eligibility', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can review bookings' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({
      where: { id },
      include: { slot: true, review: true },
    });
    if (!booking || booking.patientUserId !== patient.id) return reply.notFound('Buchung nicht gefunden');

    if (booking.review) {
      return reply.send({
        eligible: false,
        alreadyReviewed: true,
        review: { rating: booking.review.rating, comment: booking.review.comment },
      });
    }

    return reply.send({ eligible: isBookingReviewable(booking), alreadyReviewed: false });
  });

  // POST /bookings/:id/reviews — Bewertung für eine Buchung abgeben
  fastify.post('/bookings/:id/reviews', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can review bookings' });

    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({
      where: { id },
      include: { slot: true, review: true },
    });
    if (!booking || booking.patientUserId !== patient.id) return reply.notFound('Buchung nicht gefunden');
    if (booking.review) return reply.status(409).send({ error: 'Buchung wurde bereits bewertet' });
    if (!isBookingReviewable(booking)) return reply.status(400).send({ error: 'Buchung kann noch nicht bewertet werden' });

    const { rating, comment } = parsed.data;
    const review = await fastify.prisma.therapistReview.create({
      data: {
        therapistId: booking.therapistId,
        patientUserId: patient.id,
        bookingRequestId: booking.id,
        rating,
        comment: comment ?? null,
      },
    });

    return reply.status(201).send({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    });
  });
}
