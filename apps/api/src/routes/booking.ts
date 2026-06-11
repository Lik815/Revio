import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendPushNotification } from '../utils/push.js';
import { expireStaleBookings } from '../utils/booking-expiry.js';

async function resolvePatient(fastify: FastifyInstance, token: string) {
  const user = await fastify.prisma.user.findUnique({ where: { sessionToken: token } });
  if (!user || user.role !== 'patient') return null;
  return user;
}

async function resolveTherapist(fastify: FastifyInstance, token: string) {
  const user = await fastify.prisma.user.findUnique({
    where: { sessionToken: token },
    include: { therapistProfile: true },
  });
  if (user?.role === 'therapist' && user.therapistProfile) return user.therapistProfile;
  const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
  return therapist ?? null;
}

function serializeSlot(slot: { id: string; startsAt: Date; durationMin: number; status: string } | null | undefined) {
  if (!slot) return null;
  return { id: slot.id, startsAt: slot.startsAt.toISOString(), durationMin: slot.durationMin, status: slot.status };
}


export async function bookingRoutes(fastify: FastifyInstance) {

  // ── Therapeut: Slot-Verwaltung ──────────────────────────────────────────

  // GET /therapist/slots — Eigene Slots auflisten
  fastify.get('/therapist/slots', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage slots' });

    const { from, to } = request.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const slots = await fastify.prisma.therapistSlot.findMany({
      where: {
        therapistId: therapist.id,
        OR: [
          { startsAt: { gte: fromDate, lte: toDate } },
          { status: 'BOOKED', booking: { status: 'PENDING' } },
        ],
      },
      include: { booking: { select: { id: true, patientName: true, patientEmail: true, patientPhone: true, status: true } } },
      orderBy: { startsAt: 'asc' },
    });

    return { slots: slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      durationMin: s.durationMin,
      status: s.status,
      bookingId: s.booking?.id ?? null,
      patientName: s.booking?.patientName ?? null,
      patientEmail: s.booking?.patientEmail ?? null,
      patientPhone: s.booking?.patientPhone ?? null,
      bookingStatus: s.booking?.status ?? null,
      createdAt: s.createdAt.toISOString(),
    })) };
  });

  // POST /therapist/slots — Einen oder mehrere Slots anlegen
  fastify.post('/therapist/slots', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can create slots' });

    const schema = z.object({
      slots: z.array(z.object({
        startsAt: z.string().datetime(),
        durationMin: z.number().int().min(5).max(120).optional(),
      })).min(1).max(50),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const now = new Date();
    const future = parsed.data.slots.filter((s) => new Date(s.startsAt) > now);
    if (future.length === 0) return reply.status(400).send({ error: 'All slots must be in the future' });

    const futureDates = future.map((s) => new Date(s.startsAt));
    const existing = await fastify.prisma.therapistSlot.findMany({
      where: { therapistId: therapist.id, startsAt: { in: futureDates } },
      select: { startsAt: true },
    });
    if (existing.length > 0) {
      const duplicates = existing.map((s) => s.startsAt.toISOString()).join(', ');
      return reply.status(409).send({ error: `Duplicate slot times: ${duplicates}` });
    }

    const created = await fastify.prisma.$transaction(
      future.map((s) =>
        fastify.prisma.therapistSlot.create({
          data: { therapistId: therapist.id, startsAt: new Date(s.startsAt), durationMin: s.durationMin ?? 20 },
        }),
      ),
    );

    return reply.status(201).send({ created: created.map(serializeSlot) });
  });

  // PATCH /therapist/slots/:id — Slot stornieren (nur AVAILABLE)
  fastify.patch('/therapist/slots/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage slots' });

    const { id } = request.params as { id: string };
    const slot = await fastify.prisma.therapistSlot.findUnique({ where: { id } });
    if (!slot) return reply.status(404).send({ error: 'Slot not found' });
    if (slot.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your slot' });
    if (slot.status === 'BOOKED') return reply.status(409).send({ error: 'Cannot cancel a booked slot. Decline the booking first.' });
    if (slot.status === 'CANCELLED') return reply.status(400).send({ error: 'Slot is already cancelled' });

    const updated = await fastify.prisma.therapistSlot.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { ...serializeSlot(updated) };
  });

  // DELETE /therapist/slots/:id — Slot löschen (nur AVAILABLE oder CANCELLED)
  fastify.delete('/therapist/slots/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can delete slots' });

    const { id } = request.params as { id: string };
    const slot = await fastify.prisma.therapistSlot.findUnique({ where: { id } });
    if (!slot) return reply.status(404).send({ error: 'Slot not found' });
    if (slot.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your slot' });
    if (slot.status === 'BOOKED') return reply.status(409).send({ error: 'Cannot delete a booked slot. Decline the booking first.' });

    await fastify.prisma.therapistSlot.delete({ where: { id } });
    return { deleted: true };
  });

  // ── Patient: Buchung ────────────────────────────────────────────────────

  // POST /bookings — Patient bucht einen Slot
  fastify.post('/bookings', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can create booking requests' });

    const schema = z.object({
      therapistId: z.string(),
      slotId: z.string(),
      message: z.string().max(1000).optional(),
      consentAccepted: z.literal(true),
      // Legacy-Felder werden ignoriert, damit bestehende Mobile-Calls nicht brechen
      preferredDays: z.string().optional(),
      preferredTimeWindows: z.string().optional(),
      patientName: z.string().optional(),
      patientEmail: z.string().optional(),
      patientPhone: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const { therapistId, slotId, message } = parsed.data;

    // Therapeut und Modus prüfen
    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.status(404).send({ error: 'Therapist not found' });
    if (therapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') {
      return reply.status(400).send({ error: 'This therapist does not accept booking requests' });
    }

    // Patientenname aus Account ableiten
    const patientName = `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.email;

    const now = new Date();

    // Alles atomar in einer Transaktion
    try {
      const result = await fastify.prisma.$transaction(async (tx) => {
        const slot = await tx.therapistSlot.findUnique({ where: { id: slotId } });
        if (!slot) throw Object.assign(new Error('Slot not found'), { code: 404 });
        if (slot.therapistId !== therapistId) throw Object.assign(new Error('Slot does not belong to this therapist'), { code: 400 });
        if (slot.status !== 'AVAILABLE') throw Object.assign(new Error('Slot is no longer available'), { code: 409 });
        if (slot.startsAt <= now) throw Object.assign(new Error('Slot is in the past'), { code: 400 });

        await tx.therapistSlot.update({ where: { id: slotId }, data: { status: 'BOOKED' } });

        return tx.bookingRequest.create({
          data: {
            therapistId,
            patientUserId: patient.id,
            slotId,
            status: 'PENDING',
            patientName,
            patientEmail: patient.email,
            patientPhone: (patient as any).phone ?? null,
            confirmedSlotAt: slot.startsAt,
            consentAcceptedAt: now,
            responseDueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            message,
          },
          include: { slot: true },
        });
      });

      if (therapist.expoPushToken) {
        sendPushNotification(
          therapist.expoPushToken,
          'Neue Terminanfrage',
          `${patientName} hat einen Termin am ${new Date(result.confirmedSlotAt!).toLocaleDateString('de-DE')} gebucht.`,
          { bookingId: result.id, screen: 'bookings' },
        );
      }

      return reply.status(201).send({
        id: result.id,
        status: result.status,
        slot: serializeSlot(result.slot),
        expiresAt: result.responseDueAt,
      });
    } catch (err: any) {
      // Custom errors thrown inside the transaction carry a numeric .code
      if (typeof err.code === 'number') {
        return reply.status(err.code).send({ error: err.message });
      }
      // Prisma unique-constraint violation (e.g. slotId already booked)
      if (err.code === 'P2002') {
        return reply.status(409).send({ error: 'Slot ist nicht mehr verfügbar.' });
      }
      // Any other Prisma / unexpected error
      fastify.log.error({ err }, 'POST /bookings unexpected error');
      return reply.status(500).send({ error: 'Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.' });
    }
  });

  // GET /bookings/my — Patient sieht eigene Buchungen
  fastify.get('/bookings/my', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can view their bookings' });

    await expireStaleBookings(fastify, { patientUserId: patient.id });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { patientUserId: patient.id },
      include: {
        slot: true,
        therapist: { select: { id: true, fullName: true, professionalTitle: true, city: true, photo: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(bookings.map((b) => ({ ...b, slot: serializeSlot(b.slot) })));
  });

  // GET /bookings/incoming — Therapeut sieht eingehende Buchungen
  fastify.get('/bookings/incoming', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can view incoming bookings' });

    await expireStaleBookings(fastify, { therapistId: therapist.id });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id },
      include: { slot: true },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(bookings.map((b) => ({ ...b, slot: serializeSlot(b.slot) })));
  });

  // PATCH /bookings/:id/respond — Therapeut bestätigt oder lehnt ab
  fastify.patch('/bookings/:id/respond', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can respond to bookings' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your booking' });
    if (booking.status !== 'PENDING') return reply.status(400).send({ error: 'Booking is no longer pending' });

    const schema = z.discriminatedUnion('action', [
      z.object({ action: z.literal('CONFIRM') }),
      z.object({ action: z.literal('DECLINE'), declinedReason: z.string().optional() }),
    ]);

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const now = new Date();

    if (parsed.data.action === 'CONFIRM') {
      const confirmedAt = booking.slot?.startsAt ?? booking.confirmedSlotAt ?? now;
      const updated = await fastify.prisma.bookingRequest.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedSlotAt: confirmedAt, respondedAt: now },
        include: { slot: true },
      });

      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        const slotDate = confirmedAt.toLocaleDateString('de-DE');
        sendPushNotification(patientUser.expoPushToken, 'Termin bestätigt 🎉',
          `${therapist.fullName} hat deinen Termin am ${slotDate} bestätigt.`,
          { bookingId: booking.id, screen: 'bookings' });
      }

      return reply.send({ ...updated, slot: serializeSlot(updated.slot) });
    } else {
      const declineData = parsed.data as { action: 'DECLINE'; declinedReason?: string };
      const updated = await fastify.prisma.$transaction(async (tx) => {
        const u = await tx.bookingRequest.update({
          where: { id },
          data: { status: 'DECLINED', declinedReason: declineData.declinedReason, respondedAt: now, slotId: null },
          include: { slot: true },
        });
        if (booking.slotId) {
          await tx.therapistSlot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } });
        }
        return u;
      });

      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        sendPushNotification(patientUser.expoPushToken, 'Terminanfrage abgelehnt',
          `${therapist.fullName} konnte deinen Termin leider nicht bestätigen.`,
          { bookingId: booking.id, screen: 'bookings' });
      }

      return reply.send({ ...updated, slot: serializeSlot(updated.slot) });
    }
  });

  // PATCH /bookings/:id/cancel — Patient storniert eigene PENDING-Buchung
  fastify.patch('/bookings/:id/cancel', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can cancel booking requests' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({
      where: { id },
      include: { therapist: { select: { fullName: true, expoPushToken: true } } },
    });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.patientUserId !== patient.id) return reply.status(403).send({ error: 'Not your booking' });
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') return reply.status(400).send({ error: 'Only pending or confirmed bookings can be cancelled' });

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const u = await tx.bookingRequest.update({ where: { id }, data: { status: 'CANCELLED', respondedAt: new Date(), slotId: null } });
      if (booking.slotId) {
        await tx.therapistSlot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } });
      }
      return u;
    });

    if (booking.therapist.expoPushToken) {
      const patientName = booking.patientName ?? 'Ein Patient';
      const isConfirmed = booking.status === 'CONFIRMED';
      sendPushNotification(
        booking.therapist.expoPushToken,
        isConfirmed ? 'Termin storniert' : 'Terminanfrage storniert',
        isConfirmed
          ? `${patientName} hat den bestätigten Termin storniert.`
          : `${patientName} hat die Buchungsanfrage storniert.`,
        { bookingId: booking.id, screen: 'bookings' },
      );
    }

    return reply.send(updated);
  });

  // PATCH /bookings/:id/therapist-cancel — Therapeut storniert eigene CONFIRMED-Buchung
  fastify.patch('/bookings/:id/therapist-cancel', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can cancel confirmed bookings' });

    const { id } = request.params as { id: string };
    const booking = await fastify.prisma.bookingRequest.findUnique({ where: { id } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your booking' });
    if (booking.status !== 'CONFIRMED') return reply.status(400).send({ error: 'Only confirmed bookings can be cancelled this way' });

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const u = await tx.bookingRequest.update({ where: { id }, data: { status: 'CANCELLED', respondedAt: new Date(), slotId: null } });
      if (booking.slotId) {
        await tx.therapistSlot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } });
      }
      return u;
    });

    const patientUser = booking.patientUserId
      ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
      : null;
    if (patientUser?.expoPushToken) {
      sendPushNotification(
        patientUser.expoPushToken,
        'Termin abgesagt',
        `${therapist.fullName} musste deinen Termin leider absagen.`,
        { bookingId: booking.id, screen: 'bookings' },
      );
    }

    return reply.send(updated);
  });
}
