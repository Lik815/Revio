import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  TherapistPatientListItem, TherapistPatientAppointment, TherapistWorkingHoursRule,
} from '@revio/shared';
import { sendPushNotification } from '../utils/push.js';
import { expireStaleBookings } from '../utils/booking-expiry.js';
import { generateAvailableSlots, resolveServiceConfig } from '../utils/slot-generator.js';
import { getTherapistOfferedHeilmittelKeys, syncTherapistHeilmittelFromServices } from '../utils/therapist-services.js';

// true auf PostgreSQL (prod), false auf SQLite (dev) — steuert Advisory-Lock-Nutzung.
function isPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

// djb2-Hash der therapistId → stabiler pg_advisory_xact_lock-Schlüssel pro Therapeut.
// Gibt uint32 (JS number) zurück — wird via $queryRawUnsafe direkt in SQL eingebettet
// um BigInt-Serialisierungsprobleme von Prisma's $queryRaw zu umgehen.
function therapistLockId(therapistId: string): number {
  let h = 5381;
  for (let i = 0; i < therapistId.length; i++) {
    h = ((Math.imul(33, h) ^ therapistId.charCodeAt(i)) >>> 0);
  }
  return h;
}

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

function canUseBookingMode(therapist: { reviewStatus?: string | null; bookingMode?: string | null }) {
  return therapist.reviewStatus === 'APPROVED'
    && therapist.bookingMode === 'FIRST_APPOINTMENT_REQUEST';
}

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

// Optional, additive filters for /bookings/my and /bookings/incoming.
function parseBookingListQuery(query: Record<string, unknown>) {
  const { from, to, status, limit } = query as { from?: string; to?: string; status?: string; limit?: string };
  const where: Record<string, unknown> = {};

  if (status) {
    const statuses = splitList(status);
    if (statuses.length > 0) where.status = { in: statuses };
  }

  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.confirmedSlotAt = range;
  }

  const parsedLimit = limit ? Number.parseInt(limit, 10) : NaN;
  const take = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

  return { where, take };
}

function serializeWorkingHoursRule(rule: {
  id: string; weekday: number; startMinute: number; endMinute: number;
  effectiveFrom: Date | null; effectiveUntil: Date | null; isActive: boolean;
}): TherapistWorkingHoursRule {
  return {
    id: rule.id,
    weekday: rule.weekday,
    startMinute: rule.startMinute,
    endMinute: rule.endMinute,
    effectiveFrom: rule.effectiveFrom ? rule.effectiveFrom.toISOString() : null,
    effectiveUntil: rule.effectiveUntil ? rule.effectiveUntil.toISOString() : null,
    isActive: rule.isActive,
  };
}

type PatientBooking = {
  id: string;
  status: string;
  createdAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  confirmedSlotAt: Date | null;
  respondedAt: Date | null;
  message: string | null;
  heilmittel: string | null;
  kassenart: string | null;
  declinedReason: string | null;
  cancelReason: string | null;
  patientPhone: string | null;
};

function buildPatientListItem(
  patientUser: { id: string; firstName: string | null; lastName: string | null; email: string; phone: string | null },
  bookings: PatientBooking[],
): TherapistPatientListItem {
  const sorted = [...bookings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = sorted[0];
  const now = new Date();
  const nextAppointment = bookings
    .filter((b) => b.status === 'CONFIRMED')
    .map((b) => b.startsAt ?? b.confirmedSlotAt)
    .filter((d): d is Date => !!d && d > now)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    id: patientUser.id,
    fullName: `${patientUser.firstName ?? ''} ${patientUser.lastName ?? ''}`.trim() || patientUser.email,
    email: patientUser.email,
    phone: patientUser.phone ?? latest.patientPhone ?? null,
    addressLine: null,
    bookingCount: bookings.length,
    lastBookingAt: latest.createdAt.toISOString(),
    nextAppointmentAt: nextAppointment ? nextAppointment.toISOString() : null,
    lastStatus: latest.status as TherapistPatientListItem['lastStatus'],
  };
}

function serializePatientAppointment(booking: PatientBooking): TherapistPatientAppointment {
  return {
    id: booking.id,
    status: booking.status as TherapistPatientAppointment['status'],
    startsAt: (booking.startsAt ?? booking.confirmedSlotAt)?.toISOString() ?? null,
    endsAt: booking.endsAt?.toISOString() ?? null,
    confirmedSlotAt: (booking.startsAt ?? booking.confirmedSlotAt)?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    respondedAt: booking.respondedAt?.toISOString() ?? null,
    message: booking.message,
    heilmittel: booking.heilmittel,
    kassenart: booking.kassenart,
    declinedReason: booking.declinedReason,
    cancelReason: booking.cancelReason,
  };
}

export async function bookingRoutes(fastify: FastifyInstance) {

  // GET /therapist/slots (kept as 410 tombstone for 1 release cycle)
  fastify.get('/therapist/slots', async (_request, reply) => {
    return reply.status(410).send({ error: 'Dieser Endpunkt wurde entfernt. Nutze GET /therapist/working-hours und GET /therapists/:id/available-slots.' });
  });

  // ── (interne Hilfsfunktion für alten Endpoint — jetzt 410) ──────────────
  // Dieser Block ersetzt alle alten Slot-CRUD-Routen.
  // ────────────────────────────────────────────────────────────────────────

  // POST /therapist/slots — ENTFERNT
  fastify.post('/therapist/slots', async (_request, reply) => {
    return reply.status(410).send({ error: 'Dieser Endpunkt wurde entfernt.' });
  });

  // PATCH /therapist/slots/:id — ENTFERNT
  fastify.patch('/therapist/slots/:slotId', async (_request, reply) => {
    return reply.status(410).send({ error: 'Dieser Endpunkt wurde entfernt.' });
  });

  // DELETE /therapist/slots/:id — ENTFERNT
  fastify.delete('/therapist/slots/:slotId_del', async (_request, reply) => {
    return reply.status(410).send({ error: 'Dieser Endpunkt wurde entfernt.' });
  });

  // POST /therapist/slots/bulk-delete — ENTFERNT
  fastify.post('/therapist/slots/bulk-delete', async (_request, reply) => {
    return reply.status(410).send({ error: 'Dieser Endpunkt wurde entfernt.' });
  });

  // GET /therapist/working-hours — Eigene Arbeitszeiten-Regeln auflisten
  fastify.get('/therapist/working-hours', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage working hours' });

    const rules = await fastify.prisma.therapistWorkingHoursRule.findMany({
      where: { therapistId: therapist.id },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });

    return { rules: rules.map(serializeWorkingHoursRule) };
  });

  // PUT /therapist/working-hours — Arbeitszeiten-Regeln vollständig ersetzen.
  // Slots werden nicht mehr materialisiert — freie Zeitfenster werden live
  // aus den Regeln, Blockzeiten und Buchungen berechnet (generateAvailableSlots).
  fastify.put('/therapist/working-hours', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage working hours' });
    if (!canUseBookingMode(therapist)) {
      return reply.status(400).send({ error: 'Terminanfragen können erst nach der Profilprüfung aktiviert werden.' });
    }

    const ruleSchema = z.object({
      weekday: z.number().int().min(0).max(6),
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(0).max(1439),
      // durationMin wird aus Kompatibilität noch akzeptiert aber ignoriert
      durationMin: z.number().int().min(5).max(120).optional(),
      effectiveFrom: z.string().datetime().nullable().optional(),
      effectiveUntil: z.string().datetime().nullable().optional(),
      isActive: z.boolean().optional(),
    }).refine((r) => r.endMinute >= r.startMinute, { message: 'endMinute must be >= startMinute' });

    const schema = z.object({ rules: z.array(ruleSchema).max(50) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    await fastify.prisma.therapistWorkingHoursRule.deleteMany({ where: { therapistId: therapist.id } });

    const created = parsed.data.rules.length > 0
      ? await fastify.prisma.$transaction(
          parsed.data.rules.map((r) =>
            fastify.prisma.therapistWorkingHoursRule.create({
              data: {
                therapistId: therapist.id,
                weekday: r.weekday,
                startMinute: r.startMinute,
                endMinute: r.endMinute,
                effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : null,
                effectiveUntil: r.effectiveUntil ? new Date(r.effectiveUntil) : null,
                isActive: r.isActive ?? true,
              },
            }),
          ),
        )
      : [];

    return reply.send({ rules: created.map(serializeWorkingHoursRule) });
  });

  // GET /therapist/patients — Eigene Patient:innen auflisten (dedupliziert über Buchungen)
  fastify.get('/therapist/patients', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can view their patients' });

    await expireStaleBookings(fastify, { therapistId: therapist.id });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id, patientUserId: { not: null } },
      include: { patientUser: true },
      orderBy: { createdAt: 'desc' },
    });

    const groups = new Map<string, { patientUser: NonNullable<(typeof bookings)[number]['patientUser']>; bookings: PatientBooking[] }>();
    for (const booking of bookings) {
      if (!booking.patientUserId || !booking.patientUser) continue;
      const existing = groups.get(booking.patientUserId);
      if (existing) existing.bookings.push(booking);
      else groups.set(booking.patientUserId, { patientUser: booking.patientUser, bookings: [booking] });
    }

    const patients = [...groups.values()]
      .map(({ patientUser, bookings: group }) => buildPatientListItem(patientUser, group))
      .sort((a, b) => new Date(b.lastBookingAt).getTime() - new Date(a.lastBookingAt).getTime());

    return { patients };
  });

  // GET /therapist/patients/:patientUserId — Patient:in-Detail + Terminverlauf mit diesem Therapeuten
  fastify.get('/therapist/patients/:patientUserId', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can view their patients' });

    await expireStaleBookings(fastify, { therapistId: therapist.id });

    const { patientUserId } = request.params as { patientUserId: string };
    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id, patientUserId },
      include: { patientUser: true },
      orderBy: { createdAt: 'desc' },
    });

    if (bookings.length === 0 || !bookings[0].patientUser) {
      return reply.status(404).send({ error: 'Patient not found' });
    }

    const patient = buildPatientListItem(bookings[0].patientUser, bookings);
    const appointments = bookings.map(serializePatientAppointment);

    return { patient, appointments };
  });

  // ── Patient: Buchung ────────────────────────────────────────────────────

  // POST /bookings — Patient bucht ein Zeitfenster (dynamisches Buchungssystem)
  fastify.post('/bookings', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can create booking requests' });

    const schema = z.object({
      therapistId: z.string(),
      startsAt: z.string().datetime(),
      heilmittel: z.string(),
      message: z.string().max(1000).optional(),
      consentAccepted: z.literal(true),
      kassenart: z.enum(['gesetzlich', 'privat', 'selbstzahler']).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const { therapistId, startsAt: startsAtStr, heilmittel, message, kassenart } = parsed.data;

    // Therapeut und Modus prüfen
    const therapist = await fastify.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) return reply.status(404).send({ error: 'Therapist not found' });
    if (!canUseBookingMode(therapist)) {
      return reply.status(400).send({ error: 'This therapist does not accept booking requests' });
    }
    const offeredKeys = await getTherapistOfferedHeilmittelKeys(fastify.prisma, therapist);
    if (!offeredKeys.includes(heilmittel)) {
      return reply.status(400).send({ error: 'Dieses Heilmittel wird von diesem Therapeuten nicht angeboten.' });
    }

    const now = new Date();
    const startsAt = new Date(startsAtStr);
    if (startsAt <= now) {
      return reply.status(400).send({ error: 'Der gewählte Termin liegt in der Vergangenheit.' });
    }

    // Leistungsdauer auflösen (gleiche Logik wie der Slot-Generator).
    // Deaktivierte Leistung → ablehnen.
    const service = await resolveServiceConfig(fastify, therapistId, heilmittel);
    if (service.disabled) {
      return reply.status(400).send({ error: 'Diese Leistung ist aktuell nicht buchbar.' });
    }
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

    // Server-seitige Validierung, dass startsAt wirklich ein buchbares Zeitfenster
    // ist — deckt Arbeitszeit, Raster-Ausrichtung, Blockzeiten und bestehende
    // Buchungen über dieselbe Single-Source-of-Truth ab (kein Buchen außerhalb
    // der Arbeitszeit oder zu "krummen" Zeiten). Die verbindliche Overlap-Prüfung
    // gegen Races passiert zusätzlich in der Transaktion unten.
    const dayStart = new Date(startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startsAt);
    dayEnd.setHours(23, 59, 59, 999);
    const daySlots = await generateAvailableSlots(fastify, therapistId, heilmittel, { from: dayStart, to: dayEnd }, now);
    const isBookable = daySlots.some((s) => s.startsAt.getTime() === startsAt.getTime());
    if (!isBookable) {
      return reply.status(409).send({ error: 'Der gewählte Termin ist nicht (mehr) verfügbar.' });
    }

    const patientName = `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.email;

    try {
      const result = await fastify.prisma.$transaction(async (tx) => {
        // Advisory Lock: serialisiert gleichzeitige Buchungen desselben Therapeuten
        // (nur PostgreSQL; SQLite überspringen — kein $queryRaw-Support für diese Syntax).
        if (isPostgres()) {
          await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${therapistLockId(therapistId)}::bigint)`);
        }

        // Race-Condition-Schutz: Überschneidung mit bestehenden PENDING/CONFIRMED-Buchungen
        const bookingConflict = await tx.bookingRequest.findFirst({
          where: {
            therapistId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (bookingConflict) throw Object.assign(new Error('Zeitfenster nicht mehr verfügbar.'), { code: 409 });

        // Überschneidung mit Blockzeiten
        const blockedConflict = await tx.therapistBlockedTime.findFirst({
          where: {
            therapistId,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (blockedConflict) throw Object.assign(new Error('Zeitfenster ist blockiert.'), { code: 409 });

        return tx.bookingRequest.create({
          data: {
            therapistId,
            patientUserId: patient.id,
            status: 'PENDING',
            patientName,
            patientEmail: patient.email,
            patientPhone: (patient as any).phone ?? null,
            startsAt,
            endsAt,
            confirmedSlotAt: startsAt,
            consentAcceptedAt: now,
            responseDueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            message,
            heilmittel,
            kassenart,
          },
        });
      });

      if (therapist.expoPushToken) {
        sendPushNotification(
          therapist.expoPushToken,
          'Neue Terminanfrage',
          `${patientName} hat einen Termin am ${startsAt.toLocaleDateString('de-DE')} gebucht.`,
          { bookingId: result.id, screen: 'bookings' },
        );
      }

      return reply.status(201).send({
        id: result.id,
        status: result.status,
        startsAt: result.startsAt?.toISOString(),
        endsAt: result.endsAt?.toISOString(),
        expiresAt: result.responseDueAt,
      });
    } catch (err: any) {
      if (typeof err.code === 'number') {
        return reply.status(err.code).send({ error: err.message });
      }
      fastify.log.error({ err }, 'POST /bookings unexpected error');
      return reply.status(500).send({
        error: 'Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
        _debug: String(err?.message ?? err),
        _prismaCode: err?.code,
      });
    }
  });

  // GET /bookings/my — Patient sieht eigene Buchungen
  fastify.get('/bookings/my', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Only patients can view their bookings' });

    await expireStaleBookings(fastify, { patientUserId: patient.id });

    const { where: listFilters, take } = parseBookingListQuery(request.query as Record<string, unknown>);

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { patientUserId: patient.id, ...listFilters },
      include: {
        therapist: { select: { id: true, fullName: true, professionalTitle: true, city: true, photo: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    });

    return reply.send(bookings);
  });

  // GET /bookings/incoming — Therapeut sieht eingehende Buchungen
  fastify.get('/bookings/incoming', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can view incoming bookings' });

    await expireStaleBookings(fastify, { therapistId: therapist.id });

    const { where: listFilters, take } = parseBookingListQuery(request.query as Record<string, unknown>);

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id, ...listFilters },
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    });

    return reply.send(bookings);
  });

  // PATCH /bookings/:id/respond — Therapeut bestätigt oder lehnt ab
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
      z.object({ action: z.literal('CONFIRM') }),
      z.object({ action: z.literal('DECLINE'), declinedReason: z.string().optional() }),
    ]);

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const now = new Date();

    if (parsed.data.action === 'CONFIRM') {
      const confirmedAt = booking.startsAt ?? booking.confirmedSlotAt ?? now;
      const updated = await fastify.prisma.bookingRequest.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedSlotAt: confirmedAt, respondedAt: now },
      });

      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        sendPushNotification(patientUser.expoPushToken, 'Termin bestätigt 🎉',
          `${therapist.fullName} hat deinen Termin am ${confirmedAt.toLocaleDateString('de-DE')} bestätigt.`,
          { bookingId: booking.id, screen: 'bookings' });
      }

      return reply.send(updated);
    } else {
      const declineData = parsed.data as { action: 'DECLINE'; declinedReason?: string };
      const updated = await fastify.prisma.bookingRequest.update({
        where: { id },
        data: { status: 'DECLINED', declinedReason: declineData.declinedReason, respondedAt: now },
      });

      const patientUser = booking.patientUserId
        ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
        : null;
      if (patientUser?.expoPushToken) {
        sendPushNotification(patientUser.expoPushToken, 'Terminanfrage abgelehnt',
          `${therapist.fullName} konnte deinen Termin leider nicht bestätigen.`,
          { bookingId: booking.id, screen: 'bookings' });
      }

      return reply.send(updated);
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

    // Reason is only required once a booking was actually CONFIRMED — a
    // still-PENDING request never became a real appointment, so there is
    // nothing to explain yet.
    const cancelSchema = z.object({ cancelReason: z.string().trim().max(500).optional() });
    const parsedCancel = cancelSchema.safeParse(request.body ?? {});
    if (!parsedCancel.success) return reply.status(400).send({ error: 'Invalid request', details: parsedCancel.error.flatten() });
    const cancelReason = parsedCancel.data.cancelReason || null;
    if (booking.status === 'CONFIRMED' && !cancelReason) {
      return reply.status(400).send({ error: 'Bitte gib einen Grund an.' });
    }

    const updated = await fastify.prisma.bookingRequest.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date(), cancelReason, cancelledBy: 'PATIENT', cancelledAt: new Date() },
    });

    if (booking.therapist.expoPushToken) {
      const patientName = booking.patientName ?? 'Ein Patient';
      const isConfirmed = booking.status === 'CONFIRMED';
      sendPushNotification(
        booking.therapist.expoPushToken,
        isConfirmed ? 'Termin storniert' : 'Terminanfrage storniert',
        isConfirmed
          ? `${patientName} hat den bestätigten Termin storniert. Der Grund ist in den Termindetails sichtbar.`
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

    // This endpoint only ever cancels CONFIRMED bookings, so the reason is
    // unconditionally required (no PENDING case to exempt, unlike /cancel).
    const therapistCancelSchema = z.object({ cancelReason: z.string().trim().max(500) });
    const parsedTherapistCancel = therapistCancelSchema.safeParse(request.body ?? {});
    if (!parsedTherapistCancel.success || !parsedTherapistCancel.data.cancelReason) {
      return reply.status(400).send({ error: 'Bitte gib einen Grund an.' });
    }
    const cancelReason = parsedTherapistCancel.data.cancelReason;

    const updated = await fastify.prisma.bookingRequest.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date(), cancelReason, cancelledBy: 'THERAPIST', cancelledAt: new Date() },
    });

    const patientUser = booking.patientUserId
      ? await fastify.prisma.user.findUnique({ where: { id: booking.patientUserId } })
      : null;
    if (patientUser?.expoPushToken) {
      sendPushNotification(
        patientUser.expoPushToken,
        'Termin abgesagt',
        `${therapist.fullName} musste deinen Termin leider absagen. Der Grund ist in den Termindetails sichtbar.`,
        { bookingId: booking.id, screen: 'bookings' },
      );
    }

    return reply.send(updated);
  });

  // ── Therapeut: Leistungskonfiguration ──────────────────────────────────────

  // GET /therapist/services — Konfigurierte Leistungen (heilmittelKey + Dauer) auflisten
  fastify.get('/therapist/services', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage services' });

    const [allOptions, existingServices] = await Promise.all([
      fastify.prisma.heilmittelOption.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      }),
      fastify.prisma.therapistService.findMany({
        where: { therapistId: therapist.id },
      }),
    ]);

    const serviceMap = new Map(existingServices.map(s => [s.heilmittelKey, s]));
    const services = allOptions.map(opt => {
      const existing = serviceMap.get(opt.key);
      return {
        id: existing?.id ?? null,
        therapistId: therapist.id,
        heilmittelKey: opt.key,
        label: opt.label,
        durationMin: existing?.durationMin ?? opt.defaultDurationMin,
        bufferAfterMin: existing?.bufferAfterMin ?? 0,
        slotIntervalMin: existing?.slotIntervalMin ?? null,
        isActive: existing?.isActive ?? false,
        colorHex: existing?.colorHex ?? null,
        createdAt: existing?.createdAt?.toISOString() ?? null,
        updatedAt: existing?.updatedAt?.toISOString() ?? null,
      };
    });

    return { services };
  });

  // PUT /therapist/services/:heilmittelKey — Leistungskonfiguration setzen (Upsert)
  fastify.put('/therapist/services/:heilmittelKey', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage services' });

    const { heilmittelKey } = request.params as { heilmittelKey: string };

    // Sicherstellen, dass der Key ein bekanntes, aktives Heilmittel ist
    const validOption = await fastify.prisma.heilmittelOption.findFirst({
      where: { key: heilmittelKey, isActive: true },
    });
    if (!validOption) {
      return reply.status(400).send({ error: `Unbekanntes oder inaktives Heilmittel: "${heilmittelKey}"` });
    }

    const schema = z.object({
      durationMin: z.number().int().min(5).max(180),
      bufferAfterMin: z.number().int().min(0).max(60).optional(),
      slotIntervalMin: z.number().int().min(5).max(180).nullable().optional(),
      isActive: z.boolean().optional(),
      colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const service = await fastify.prisma.therapistService.upsert({
      where: { therapistId_heilmittelKey: { therapistId: therapist.id, heilmittelKey } },
      create: {
        therapistId: therapist.id,
        heilmittelKey,
        durationMin: parsed.data.durationMin,
        bufferAfterMin: parsed.data.bufferAfterMin ?? 0,
        slotIntervalMin: parsed.data.slotIntervalMin ?? null,
        isActive: parsed.data.isActive ?? true,
        colorHex: parsed.data.colorHex ?? null,
      },
      update: {
        durationMin: parsed.data.durationMin,
        bufferAfterMin: parsed.data.bufferAfterMin ?? 0,
        slotIntervalMin: parsed.data.slotIntervalMin ?? null,
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.colorHex !== undefined ? { colorHex: parsed.data.colorHex } : {}),
      },
    });

    await syncTherapistHeilmittelFromServices(fastify.prisma, therapist.id);

    return reply.send(service);
  });

  // ── Therapeut: Blockzeiten ──────────────────────────────────────────────────

  // GET /therapist/blocked-times — Eigene Blockzeiten auflisten
  fastify.get('/therapist/blocked-times', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage blocked times' });

    const { from, to } = request.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const blockedTimes = await fastify.prisma.therapistBlockedTime.findMany({
      where: {
        therapistId: therapist.id,
        startsAt: { lt: toDate },
        endsAt: { gt: fromDate },
      },
      orderBy: { startsAt: 'asc' },
    });

    return {
      blockedTimes: blockedTimes.map((b) => ({
        id: b.id,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        title: b.title,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  });

  // POST /therapist/blocked-times — Neue Blockzeit anlegen
  fastify.post('/therapist/blocked-times', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage blocked times' });

    const schema = z.object({
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      title: z.string().trim().min(1).max(100).optional(),
    }).refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
      message: 'endsAt must be after startsAt',
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });

    const blocked = await fastify.prisma.therapistBlockedTime.create({
      data: {
        therapistId: therapist.id,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        title: parsed.data.title ?? 'Blockiert',
      },
    });

    return reply.status(201).send({
      id: blocked.id,
      startsAt: blocked.startsAt.toISOString(),
      endsAt: blocked.endsAt.toISOString(),
      title: blocked.title,
      createdAt: blocked.createdAt.toISOString(),
      updatedAt: blocked.updatedAt.toISOString(),
    });
  });

  // DELETE /therapist/blocked-times/:id — Blockzeit löschen
  fastify.delete('/therapist/blocked-times/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Only therapists can manage blocked times' });

    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.therapistBlockedTime.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Blocked time not found' });
    if (existing.therapistId !== therapist.id) return reply.status(403).send({ error: 'Not your blocked time' });

    await fastify.prisma.therapistBlockedTime.delete({ where: { id } });
    return reply.send({ deleted: true });
  });
}
