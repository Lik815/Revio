import { FastifyInstance } from 'fastify';
import { z } from 'zod';

async function resolveTherapist(fastify: FastifyInstance, token: string) {
  return fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
}

export async function scheduleRoutes(fastify: FastifyInstance) {

  // ─── Absences ────────────────────────────────────────────────────────────────

  // GET /schedule/absences — alle Abwesenheiten der eigenen Therapeutin
  fastify.get('/schedule/absences', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const absences = await fastify.prisma.therapistAbsence.findMany({
      where: { therapistId: therapist.id },
      orderBy: { von: 'asc' },
    });
    return reply.send(absences);
  });

  // POST /schedule/absences — neue Abwesenheit anlegen
  fastify.post('/schedule/absences', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const schema = z.object({
      von: z.string().datetime(),
      bis: z.string().datetime(),
      grund: z.enum(['URLAUB', 'FORTBILDUNG', 'KRANKHEIT', 'SONSTIGES']).default('SONSTIGES'),
      ganzePraxis: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const von = new Date(parsed.data.von);
    const bis = new Date(parsed.data.bis);
    if (bis < von) return reply.status(400).send({ error: '"bis" muss nach "von" liegen' });
    const diffDays = Math.ceil((bis.getTime() - von.getTime()) / 86_400_000);
    if (diffDays > 90) return reply.status(400).send({ error: 'Abwesenheit darf maximal 90 Tage dauern' });

    // Überlappende Absences zusammenführen
    const overlapping = await fastify.prisma.therapistAbsence.findMany({
      where: {
        therapistId: therapist.id,
        von: { lte: bis },
        bis: { gte: von },
      },
    });
    if (overlapping.length > 0) {
      const mergedVon = new Date(Math.min(von.getTime(), ...overlapping.map((a) => new Date(a.von).getTime())));
      const mergedBis = new Date(Math.max(bis.getTime(), ...overlapping.map((a) => new Date(a.bis).getTime())));
      await fastify.prisma.therapistAbsence.deleteMany({
        where: { id: { in: overlapping.map((a) => a.id) } },
      });
      const merged = await fastify.prisma.therapistAbsence.create({
        data: { therapistId: therapist.id, von: mergedVon, bis: mergedBis, grund: parsed.data.grund, ganzePraxis: parsed.data.ganzePraxis },
      });
      // Konflikt-Check gegen ScheduledSlots
      const conflicts = await fastify.prisma.scheduledSlot.findMany({
        where: { therapistId: therapist.id, startsAt: { gte: mergedVon, lte: mergedBis }, status: 'SCHEDULED' },
        select: { id: true, startsAt: true, patientName: true },
      });
      return reply.status(201).send({ absence: merged, conflicts });
    }

    const absence = await fastify.prisma.therapistAbsence.create({
      data: { therapistId: therapist.id, von, bis, grund: parsed.data.grund, ganzePraxis: parsed.data.ganzePraxis },
    });
    const conflicts = await fastify.prisma.scheduledSlot.findMany({
      where: { therapistId: therapist.id, startsAt: { gte: von, lte: bis }, status: 'SCHEDULED' },
      select: { id: true, startsAt: true, patientName: true },
    });
    return reply.status(201).send({ absence, conflicts });
  });

  // PATCH /schedule/absences/:id
  fastify.patch('/schedule/absences/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const { id } = request.params as { id: string };
    const absence = await fastify.prisma.therapistAbsence.findUnique({ where: { id } });
    if (!absence || absence.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });

    const schema = z.object({
      von: z.string().datetime().optional(),
      bis: z.string().datetime().optional(),
      grund: z.enum(['URLAUB', 'FORTBILDUNG', 'KRANKHEIT', 'SONSTIGES']).optional(),
      ganzePraxis: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const updated = await fastify.prisma.therapistAbsence.update({
      where: { id },
      data: {
        ...(parsed.data.von ? { von: new Date(parsed.data.von) } : {}),
        ...(parsed.data.bis ? { bis: new Date(parsed.data.bis) } : {}),
        ...(parsed.data.grund !== undefined ? { grund: parsed.data.grund } : {}),
        ...(parsed.data.ganzePraxis !== undefined ? { ganzePraxis: parsed.data.ganzePraxis } : {}),
      },
    });
    return reply.send(updated);
  });

  // DELETE /schedule/absences/:id
  fastify.delete('/schedule/absences/:id', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Therapeut nicht gefunden' });

    const { id } = request.params as { id: string };
    const absence = await fastify.prisma.therapistAbsence.findUnique({ where: { id } });
    if (!absence || absence.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });

    await fastify.prisma.therapistAbsence.delete({ where: { id } });
    return reply.status(204).send();
  });

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
