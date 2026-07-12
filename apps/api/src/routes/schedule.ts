import { FastifyInstance } from 'fastify';
import { z } from 'zod';

async function resolveTherapist(fastify: FastifyInstance, token: string) {
  return fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
}

export async function scheduleRoutes(fastify: FastifyInstance) {

  // Abwesenheiten (Urlaub/Fortbildung/Krankheit/Sonstiges) wurden nach
  // TherapistBlockedTime vereinheitlicht (grund-Feld) — siehe POST/GET
  // /therapist/blocked-times in booking.ts. Grund: TherapistAbsence wurde vom
  // Slot-Generator und der Buchungs-Konfliktprüfung nie berücksichtigt, sodass
  // eingetragener Urlaub Patienten-Buchungen nicht verhinderte. Alte Zeilen in
  // TherapistAbsence werden per prisma/migrate-absences-to-blocked-times.ts
  // übernommen.

  // ─── ScheduledSlots ──────────────────────────────────────────────────────────

  // GET /schedule/slots?from=ISO&to=ISO — Slots im Zeitraum (Kalender-Quelle)
  fastify.get('/schedule/slots', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const query = request.query as Record<string, string>;
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86_400_000);
    const to = query.to ? new Date(query.to) : new Date(Date.now() + 90 * 86_400_000);

    const slots = await fastify.prisma.scheduledSlot.findMany({
      where: {
        therapistId: therapist.id,
        startsAt: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startsAt: 'asc' },
    });
    return reply.send(slots);
  });

  // PATCH /schedule/slots/:id — Status ändern (z.B. COMPLETED oder Notiz setzen)
  fastify.patch('/schedule/slots/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const { id } = request.params as { id: string };
    const slot = await fastify.prisma.scheduledSlot.findUnique({ where: { id } });
    if (!slot || slot.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });

    const schema = z.object({
      status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']).optional(),
      notiz: z.string().max(200).nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten' });

    const updated = await fastify.prisma.scheduledSlot.update({
      where: { id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.notiz !== undefined ? { notiz: parsed.data.notiz } : {}),
      },
    });
    return reply.send(updated);
  });

  // POST /schedule/migrate — einmalige Datenmigration: CONFIRMED BookingRequests → ScheduledSlots
  // Idempotent: Slots die schon existieren werden übersprungen.
  fastify.post('/schedule/migrate', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const confirmed = await fastify.prisma.bookingRequest.findMany({
      where: { therapistId: therapist.id, status: 'CONFIRMED', startsAt: { not: null } },
    });

    let created = 0;
    let skipped = 0;
    for (const booking of confirmed) {
      if (!booking.startsAt || !booking.endsAt) { skipped++; continue; }
      const exists = await fastify.prisma.scheduledSlot.findFirst({
        where: { bookingRequestId: booking.id },
      });
      if (exists) { skipped++; continue; }
      await fastify.prisma.scheduledSlot.create({
        data: {
          bookingRequestId: booking.id,
          therapistId: booking.therapistId,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          heilmittel: booking.heilmittel ?? '',
          patientName: booking.patientName,
          patientPhone: booking.patientPhone ?? undefined,
          status: 'SCHEDULED',
        },
      });
      created++;
    }
    return reply.send({ created, skipped });
  });
}
