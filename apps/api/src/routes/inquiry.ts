import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolvePatient(fastify: FastifyInstance, token: string) {
  return fastify.prisma.user.findFirst({ where: { sessionToken: token, role: 'patient' } });
}

async function resolveTherapist(fastify: FastifyInstance, token: string) {
  return fastify.prisma.therapist.findFirst({ where: { sessionToken: token } });
}

// SLA: 2 Werktage (Wochenende zählt nicht)
function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function formatUhrzeit(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function datumToStartsAt(datum: string, uhrzeitVon: number): Date {
  const d = new Date(datum);
  d.setHours(0, uhrzeitVon, 0, 0);
  return d;
}

function datumToEndsAt(datum: string, uhrzeitBis: number): Date {
  const d = new Date(datum);
  d.setHours(0, uhrzeitBis, 0, 0);
  return d;
}

async function checkSlotConflict(
  fastify: FastifyInstance,
  therapistId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
) {
  return fastify.prisma.scheduledSlot.findFirst({
    where: {
      therapistId,
      status: 'SCHEDULED',
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

// Nach individuellem Slot-Confirm oder -Decline: Inquiry-Status aktualisieren
// wenn keine PENDING-Slots mehr übrig sind.
async function maybeFinalizeInquiry(
  tx: Parameters<Parameters<FastifyInstance['prisma']['$transaction']>[0]>[0],
  inquiryId: string,
  therapistId: string,
  now: Date,
) {
  const slots = await tx.inquirySlot.findMany({ where: { inquiryId } });
  const hasPending = slots.some((s) => s.status === 'PENDING');
  if (hasPending) return;

  const hasConfirmed = slots.some((s) => s.status === 'CONFIRMED');
  await tx.inquiry.update({
    where: { id: inquiryId },
    data: {
      status: hasConfirmed ? 'CONFIRMED' : 'DECLINED',
      respondedAt: now,
    },
  });

  if (hasConfirmed) {
    // Parallel-Inquiries schließen
    const inquiry = await tx.inquiry.findUnique({ where: { id: inquiryId }, select: { patientRequestId: true } });
    if (inquiry) {
      await tx.inquiry.updateMany({
        where: {
          patientRequestId: inquiry.patientRequestId,
          id: { not: inquiryId },
          status: { in: ['SENT', 'SEEN', 'COUNTER_PROPOSED'] },
        },
        data: { status: 'AUTO_CLOSED' },
      });
    }
  }
}

const ACTIVE_STATUSES = ['SENT', 'SEEN', 'COUNTER_PROPOSED', 'CONFIRMED'];

// ─── Route registration ───────────────────────────────────────────────────────

export async function inquiryRoutes(fastify: FastifyInstance) {

  // ── Patient: PatientRequest + Inquiries anlegen ───────────────────────────

  // POST /inquiry — PatientRequest + bis zu 3 Inquiries auf einmal anlegen
  fastify.post('/inquiry', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Nur Patienten können Anfragen stellen' });

    const schema = z.object({
      heilmittel: z.string().min(1),
      kassenart: z.string().default(''),
      frequenz: z.enum(['X1', 'X2', 'X3']).default('X1'),
      anzahlTermine: z.number().int().min(1).max(40).default(6),
      suchtyp: z.enum(['SERIE', 'EINZELTERMIN']).default('SERIE'),
      message: z.string().max(500).optional(),
      // SERIE: konkrete Wunschtermine (bis zu 10 Slots)
      wunschTermine: z.array(z.object({
        datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        uhrzeitVon: z.number().int().min(0).max(1439),
        uhrzeitBis: z.number().int().min(1).max(1440),
      })).min(0).max(10).default([]),
      // EINZELTERMIN: einzelner Wunschtermin
      wunschDatum: z.string().datetime().optional(),
      wunschUhrzeitVon: z.number().int().min(0).max(1439).optional(),
      wunschUhrzeitBis: z.number().int().min(1).max(1440).optional(),
      // Legacy-Feld — wird für neue Anfragen ignoriert
      timeWindows: z.array(z.any()).default([]),
      prescription: z.object({
        icdCode: z.string().optional(),
        heilmittelposNr: z.string().optional(),
        indikationsSchluessel: z.string().optional(),
        arztName: z.string().optional(),
        arztDatum: z.string().datetime().optional(),
      }).optional(),
      therapistIds: z.array(z.string()).min(1).max(3),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const { heilmittel, kassenart, frequenz, anzahlTermine, suchtyp, message,
            wunschTermine, wunschDatum, wunschUhrzeitVon, wunschUhrzeitBis,
            prescription, therapistIds } = parsed.data;

    if (suchtyp === 'SERIE' && wunschTermine.length === 0) {
      return reply.status(400).send({ error: 'Für eine Behandlungsserie sind konkrete Wunschtermine erforderlich.' });
    }
    if (suchtyp === 'EINZELTERMIN' && !wunschDatum) {
      return reply.status(400).send({ error: 'Für einen Einzeltermin muss ein Wunschtermin angegeben werden.' });
    }

    // Therapeuten prüfen
    const therapists = await fastify.prisma.therapist.findMany({
      where: {
        id: { in: therapistIds },
        reviewStatus: 'APPROVED',
        isVisible: true,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
      },
      select: { id: true },
    });
    if (therapists.length === 0) {
      return reply.status(400).send({ error: 'Diese Therapeut:innen nehmen aktuell keine Anfragen an.' });
    }

    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.email;
    const responseDueAt = addBusinessDays(new Date(), 2);
    const parallelCount = therapists.length - 1;

    const patientRequest = await fastify.prisma.$transaction(async (tx) => {
      const pr = await tx.patientRequest.create({
        data: {
          patientUserId: patient.id,
          heilmittel, kassenart, frequenz, anzahlTermine, suchtyp, message,
          ...(prescription ? {
            prescription: {
              create: {
                icdCode: prescription.icdCode,
                heilmittelposNr: prescription.heilmittelposNr,
                indikationsSchluessel: prescription.indikationsSchluessel,
                arztName: prescription.arztName,
                arztDatum: prescription.arztDatum ? new Date(prescription.arztDatum) : undefined,
              },
            },
          } : {}),
        },
        include: { prescription: true },
      });

      const inquiries = await Promise.all(therapists.map(async (t) => {
        const inq = await tx.inquiry.create({
          data: {
            patientRequestId: pr.id,
            therapistId: t.id,
            status: 'SENT',
            heilmittel, kassenart, frequenz, anzahlTermine, suchtyp,
            patientFreitext: message,
            patientName,
            patientEmail: patient.email,
            patientPhone: patient.phone ?? undefined,
            parallelAnfragenAnzahl: parallelCount,
            responseDueAt,
            ...(suchtyp === 'EINZELTERMIN' && wunschDatum ? {
              wunschDatum: new Date(wunschDatum),
              wunschUhrzeitVon: wunschUhrzeitVon ?? null,
              wunschUhrzeitBis: wunschUhrzeitBis ?? null,
            } : {}),
          },
        });

        if (suchtyp === 'SERIE' && wunschTermine.length > 0) {
          await tx.inquirySlot.createMany({
            data: wunschTermine.map((wt) => ({
              inquiryId: inq.id,
              datum: wt.datum,
              uhrzeitVon: wt.uhrzeitVon,
              uhrzeitBis: wt.uhrzeitBis,
              status: 'PENDING' as const,
            })),
          });
        }

        return inq;
      }));

      return { ...pr, inquiries };
    });

    // Auto-Accept: Serien direkt bestätigen wenn aktiviert
    if (suchtyp === 'SERIE') {
      for (const inq of patientRequest.inquiries) {
        const therapistSettings = await fastify.prisma.therapist.findUnique({
          where: { id: inq.therapistId },
          select: { autoAcceptEnabled: true, autoAcceptSeries: true, expoPushToken: true },
        });
        if (!(therapistSettings as any)?.autoAcceptEnabled || !(therapistSettings as any)?.autoAcceptSeries) continue;

        const slots = await fastify.prisma.inquirySlot.findMany({
          where: { inquiryId: inq.id, status: 'PENDING' },
          orderBy: { datum: 'asc' },
        });
        if (slots.length === 0) continue;

        // Konflikt-Check — Slots mit Konflikt überspringen, Rest bestätigen
        const now = new Date();
        const confirmedSlots: { slot: typeof slots[0]; startsAt: Date; endsAt: Date }[] = [];
        for (const slot of slots) {
          const startsAt = datumToStartsAt(slot.datum, slot.uhrzeitVon);
          const endsAt = datumToEndsAt(slot.datum, slot.uhrzeitBis);
          const conflict = await checkSlotConflict(fastify, inq.therapistId, startsAt, endsAt);
          if (conflict) continue;
          confirmedSlots.push({ slot, startsAt, endsAt });
        }
        if (confirmedSlots.length === 0) continue;

        await fastify.prisma.$transaction(async (tx) => {
          for (const { slot, startsAt, endsAt } of confirmedSlots) {
            await tx.scheduledSlot.create({
              data: {
                inquiryId: inq.id,
                inquirySlotId: slot.id,
                therapistId: inq.therapistId,
                startsAt,
                endsAt,
                heilmittel,
                patientName: inq.patientName,
                patientPhone: inq.patientPhone ?? undefined,
                status: 'SCHEDULED',
              },
            });
            await tx.inquirySlot.update({ where: { id: slot.id }, data: { status: 'CONFIRMED' } });
          }
          await tx.inquiry.update({ where: { id: inq.id }, data: { status: 'CONFIRMED', respondedAt: now } });
          await tx.therapistCapacityRule.upsert({
            where: { therapistId: inq.therapistId },
            create: { therapistId: inq.therapistId, laufendeNeuaufnahmenDieseWoche: 1, weekResetAt: now, abgeschlosseneInquiriesCount: 1 },
            update: { laufendeNeuaufnahmenDieseWoche: { increment: 1 }, abgeschlosseneInquiriesCount: { increment: 1 } },
          });
          // Parallel-Inquiries schließen
          await tx.inquiry.updateMany({
            where: { patientRequestId: inq.patientRequestId, id: { not: inq.id }, status: { in: ['SENT', 'SEEN', 'COUNTER_PROPOSED'] } },
            data: { status: 'AUTO_CLOSED' },
          });
        });
      }
    }

    return reply.status(201).send(patientRequest);
  });

  // GET /inquiry/my — eigene PatientRequests mit Inquiries (Patient)
  fastify.get('/inquiry/my', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Nur Patienten' });

    const requests = await fastify.prisma.patientRequest.findMany({
      where: { patientUserId: patient.id },
      include: {
        timeWindows: true,
        inquiries: {
          include: {
            therapist: { select: { id: true, fullName: true, professionalTitle: true, city: true, photo: true } },
            inquirySlots: { orderBy: { datum: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(requests);
  });

  // ── Therapeut: Eingehende Inquiries ───────────────────────────────────────

  // GET /inquiry/incoming — Eingehende Inquiries (Therapeut)
  fastify.get('/inquiry/incoming', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { status } = request.query as { status?: string };

    const inquiries = await fastify.prisma.inquiry.findMany({
      where: {
        therapistId: therapist.id,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        patientRequest: { include: { timeWindows: true } },
        inquirySlots: { orderBy: { datum: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(inquiries);
  });

  // ── State-Machine-Übergänge ────────────────────────────────────────────────

  // POST /inquiry/:id/seen — Therapeut öffnet Anfrage
  fastify.post('/inquiry/:id/seen', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (inquiry.status !== 'SENT') return reply.status(409).send({ error: `Ungültiger Übergang: ${inquiry.status} → SEEN` });

    const updated = await fastify.prisma.inquiry.update({
      where: { id },
      data: { status: 'SEEN' },
      include: { inquirySlots: { orderBy: { datum: 'asc' } } },
    });
    return reply.send(updated);
  });

  // POST /inquiry/:id/confirm — Therapeut bestätigt EINZELTERMIN mit Datum+Uhrzeit
  fastify.post('/inquiry/:id/confirm', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({
      where: { id },
      include: { patientRequest: true },
    });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (!['SENT', 'SEEN', 'COUNTER_PROPOSED'].includes(inquiry.status)) {
      return reply.status(409).send({ error: `Ungültiger Übergang: ${inquiry.status} → CONFIRMED` });
    }
    if (inquiry.suchtyp === 'SERIE') {
      return reply.status(400).send({ error: 'Für Serien-Anfragen bitte /confirm-all oder /slots/:slotId/confirm verwenden.' });
    }

    const schema = z.object({
      datum: z.string().datetime(),
      uhrzeitVon: z.number().int().min(0).max(1439),
      uhrzeitBis: z.number().int().min(1).max(1440),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datum und Uhrzeit erforderlich', details: parsed.error.flatten() });

    if (parsed.data.uhrzeitBis <= parsed.data.uhrzeitVon) {
      return reply.status(400).send({ error: 'uhrzeitBis muss nach uhrzeitVon liegen' });
    }

    const datum = new Date(parsed.data.datum);
    const startsAt = new Date(datum);
    startsAt.setHours(0, parsed.data.uhrzeitVon, 0, 0);
    const endsAt = new Date(datum);
    endsAt.setHours(0, parsed.data.uhrzeitBis, 0, 0);

    const conflict = await checkSlotConflict(fastify, therapist.id, startsAt, endsAt, `slot_inq_${id}`);
    if (conflict) {
      return reply.status(409).send({
        error: 'Zeitkonflikt: ein anderer Termin überschneidet sich',
        conflictingSlot: { startsAt: conflict.startsAt, endsAt: conflict.endsAt },
      });
    }

    const now = new Date();
    const [updatedInquiry] = await fastify.prisma.$transaction([
      fastify.prisma.inquiry.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedDatum: datum,
          confirmedUhrzeitVon: parsed.data.uhrzeitVon,
          confirmedUhrzeitBis: parsed.data.uhrzeitBis,
          respondedAt: now,
        },
      }),
      fastify.prisma.scheduledSlot.upsert({
        where: { id: `slot_inq_${id}` },
        create: {
          id: `slot_inq_${id}`,
          inquiryId: id,
          therapistId: therapist.id,
          startsAt,
          endsAt,
          heilmittel: inquiry.heilmittel,
          patientName: inquiry.patientName,
          patientPhone: inquiry.patientPhone ?? undefined,
          status: 'SCHEDULED',
        },
        update: { startsAt, endsAt, status: 'SCHEDULED' },
      }),
      fastify.prisma.therapistCapacityRule.upsert({
        where: { therapistId: therapist.id },
        create: { therapistId: therapist.id, laufendeNeuaufnahmenDieseWoche: 1, weekResetAt: now, abgeschlosseneInquiriesCount: 1 },
        update: { laufendeNeuaufnahmenDieseWoche: { increment: 1 }, abgeschlosseneInquiriesCount: { increment: 1 } },
      }),
    ]);

    // Parallel-Anfragen an andere Therapeuten automatisch schließen
    await fastify.prisma.inquiry.updateMany({
      where: {
        patientRequestId: inquiry.patientRequestId,
        id: { not: id },
        status: { in: ['SENT', 'SEEN', 'COUNTER_PROPOSED'] },
      },
      data: { status: 'AUTO_CLOSED' },
    });

    return reply.send({
      ...updatedInquiry,
      confirmedZeitDisplay: `${formatUhrzeit(parsed.data.uhrzeitVon)}–${formatUhrzeit(parsed.data.uhrzeitBis)}`,
    });
  });

  // POST /inquiry/:id/confirm-all — Therapeut bestätigt alle PENDING Slots einer SERIE
  fastify.post('/inquiry/:id/confirm-all', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({
      where: { id },
      include: { inquirySlots: { where: { status: 'PENDING' }, orderBy: { datum: 'asc' } } },
    });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (!['SENT', 'SEEN', 'COUNTER_PROPOSED'].includes(inquiry.status)) {
      return reply.status(409).send({ error: `Ungültiger Übergang: ${inquiry.status} → CONFIRMED` });
    }
    if (inquiry.suchtyp !== 'SERIE') {
      return reply.status(400).send({ error: 'Nur für Serien-Anfragen verfügbar. Einzeltermin: /confirm verwenden.' });
    }
    if (inquiry.inquirySlots.length === 0) {
      return reply.status(400).send({ error: 'Keine offenen Slots vorhanden.' });
    }

    // Konflikt-Check für alle Slots auf einmal
    const conflicts: { datum: string; von: string }[] = [];
    for (const slot of inquiry.inquirySlots) {
      const startsAt = datumToStartsAt(slot.datum, slot.uhrzeitVon);
      const endsAt = datumToEndsAt(slot.datum, slot.uhrzeitBis);
      const conflict = await checkSlotConflict(fastify, therapist.id, startsAt, endsAt);
      if (conflict) conflicts.push({ datum: slot.datum, von: formatUhrzeit(slot.uhrzeitVon) });
    }
    if (conflicts.length > 0) {
      return reply.status(409).send({
        error: 'Zeitkonflikte bei einzelnen Terminen',
        conflicts,
      });
    }

    const now = new Date();
    const updatedInquiry = await fastify.prisma.$transaction(async (tx) => {
      // ScheduledSlots für alle Slots anlegen
      for (const slot of inquiry.inquirySlots) {
        const startsAt = datumToStartsAt(slot.datum, slot.uhrzeitVon);
        const endsAt = datumToEndsAt(slot.datum, slot.uhrzeitBis);
        const scheduledSlot = await tx.scheduledSlot.create({
          data: {
            inquiryId: id,
            inquirySlotId: slot.id,
            therapistId: therapist.id,
            startsAt,
            endsAt,
            heilmittel: inquiry.heilmittel,
            patientName: inquiry.patientName,
            patientPhone: inquiry.patientPhone ?? undefined,
            status: 'SCHEDULED',
          },
        });
        await tx.inquirySlot.update({
          where: { id: slot.id },
          data: { status: 'CONFIRMED' },
        });
        void scheduledSlot; // suppress unused warning
      }

      const inq = await tx.inquiry.update({
        where: { id },
        data: { status: 'CONFIRMED', respondedAt: now },
        include: { inquirySlots: { orderBy: { datum: 'asc' } } },
      });

      await tx.therapistCapacityRule.upsert({
        where: { therapistId: therapist.id },
        create: { therapistId: therapist.id, laufendeNeuaufnahmenDieseWoche: 1, weekResetAt: now, abgeschlosseneInquiriesCount: 1 },
        update: { laufendeNeuaufnahmenDieseWoche: { increment: 1 }, abgeschlosseneInquiriesCount: { increment: 1 } },
      });

      // Parallel-Inquiries schließen
      await tx.inquiry.updateMany({
        where: {
          patientRequestId: inquiry.patientRequestId,
          id: { not: id },
          status: { in: ['SENT', 'SEEN', 'COUNTER_PROPOSED'] },
        },
        data: { status: 'AUTO_CLOSED' },
      });

      return inq;
    });

    return reply.send(updatedInquiry);
  });

  // POST /inquiry/:id/slots/:slotId/confirm — einzelnen InquirySlot bestätigen
  fastify.post('/inquiry/:id/slots/:slotId/confirm', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id, slotId } = request.params as { id: string; slotId: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (!['SENT', 'SEEN', 'COUNTER_PROPOSED', 'CONFIRMED'].includes(inquiry.status)) {
      return reply.status(409).send({ error: `Inquiry-Status erlaubt keine Slot-Bestätigung: ${inquiry.status}` });
    }

    const slot = await fastify.prisma.inquirySlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.inquiryId !== id) return reply.status(404).send({ error: 'Slot nicht gefunden' });
    if (slot.status !== 'PENDING') {
      return reply.status(409).send({ error: `Slot ist bereits ${slot.status}` });
    }

    const startsAt = datumToStartsAt(slot.datum, slot.uhrzeitVon);
    const endsAt = datumToEndsAt(slot.datum, slot.uhrzeitBis);

    const conflict = await checkSlotConflict(fastify, therapist.id, startsAt, endsAt);
    if (conflict) {
      return reply.status(409).send({
        error: 'Zeitkonflikt: ein anderer Termin überschneidet sich',
        conflictingSlot: { startsAt: conflict.startsAt, endsAt: conflict.endsAt },
      });
    }

    const now = new Date();
    const updatedInquiry = await fastify.prisma.$transaction(async (tx) => {
      await tx.scheduledSlot.create({
        data: {
          inquiryId: id,
          inquirySlotId: slotId,
          therapistId: therapist.id,
          startsAt,
          endsAt,
          heilmittel: inquiry.heilmittel,
          patientName: inquiry.patientName,
          patientPhone: inquiry.patientPhone ?? undefined,
          status: 'SCHEDULED',
        },
      });
      await tx.inquirySlot.update({ where: { id: slotId }, data: { status: 'CONFIRMED' } });
      await maybeFinalizeInquiry(tx, id, therapist.id, now);
      return tx.inquiry.findUnique({
        where: { id },
        include: { inquirySlots: { orderBy: { datum: 'asc' } } },
      });
    });

    return reply.send(updatedInquiry);
  });

  // POST /inquiry/:id/slots/:slotId/decline — einzelnen InquirySlot ablehnen
  fastify.post('/inquiry/:id/slots/:slotId/decline', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id, slotId } = request.params as { id: string; slotId: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });

    const slot = await fastify.prisma.inquirySlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.inquiryId !== id) return reply.status(404).send({ error: 'Slot nicht gefunden' });
    if (slot.status !== 'PENDING') {
      return reply.status(409).send({ error: `Slot ist bereits ${slot.status}` });
    }

    const now = new Date();
    const updatedInquiry = await fastify.prisma.$transaction(async (tx) => {
      await tx.inquirySlot.update({ where: { id: slotId }, data: { status: 'DECLINED' } });
      await maybeFinalizeInquiry(tx, id, therapist.id, now);
      return tx.inquiry.findUnique({
        where: { id },
        include: { inquirySlots: { orderBy: { datum: 'asc' } } },
      });
    });

    return reply.send(updatedInquiry);
  });

  // POST /inquiry/:id/decline — Therapeut lehnt gesamte Anfrage ab
  fastify.post('/inquiry/:id/decline', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const therapist = await resolveTherapist(fastify, token);
    if (!therapist) return reply.status(403).send({ error: 'Nur Therapeut:innen' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry || inquiry.therapistId !== therapist.id) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (!['SENT', 'SEEN'].includes(inquiry.status)) {
      return reply.status(409).send({ error: `Ungültiger Übergang: ${inquiry.status} → DECLINED` });
    }

    const schema = z.object({
      ablehnungsgrund: z.string().max(200).optional(),
    });
    const parsed = schema.safeParse(request.body);

    const updated = await fastify.prisma.inquiry.update({
      where: { id },
      data: {
        status: 'DECLINED',
        ablehnungsgrund: parsed.success ? parsed.data.ablehnungsgrund : undefined,
        respondedAt: new Date(),
      },
    });
    return reply.send(updated);
  });

  // POST /inquiry/:id/cancel — Termin absagen (CONFIRMED → CANCELLED), Praxis oder Patient
  fastify.post('/inquiry/:id/cancel', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (inquiry.status !== 'CONFIRMED') {
      return reply.status(409).send({ error: `Nur CONFIRMED-Inquiries können abgesagt werden (Status: ${inquiry.status})` });
    }

    // Actor bestimmen: Therapeut oder Patient
    const therapist = await resolveTherapist(fastify, token);
    const patient = await resolvePatient(fastify, token);

    let actor: 'PRAXIS' | 'PATIENT';
    if (therapist && inquiry.therapistId === therapist.id) {
      actor = 'PRAXIS';
    } else if (patient) {
      const pr = await fastify.prisma.patientRequest.findFirst({
        where: { id: inquiry.patientRequestId, patientUserId: patient.id },
      });
      if (!pr) return reply.status(403).send({ error: 'Keine Berechtigung' });
      actor = 'PATIENT';
    } else {
      return reply.status(403).send({ error: 'Keine Berechtigung' });
    }

    const schema = z.object({
      cancelReason: actor === 'PRAXIS'
        ? z.enum(['PRAXIS_KRANKHEIT', 'PRAXIS_ABSAGE', 'PATIENT_WUNSCH', 'SONSTIGES'])
        : z.enum(['PRAXIS_KRANKHEIT', 'PRAXIS_ABSAGE', 'PATIENT_WUNSCH', 'SONSTIGES']).optional(),
      cancelFreitext: z.string().max(200).optional(),
    });
    const parsed = schema.safeParse(request.body);

    if (actor === 'PRAXIS' && (!parsed.success || !parsed.data.cancelReason)) {
      return reply.status(400).send({ error: 'cancelReason ist für Praxis-Absagen Pflicht' });
    }

    const now = new Date();
    const updatedInquiry = await fastify.prisma.$transaction(async (tx) => {
      const inq = await tx.inquiry.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: parsed.success ? parsed.data.cancelReason as any : undefined,
          cancelActor: actor,
          cancelledAt: now,
        },
      });

      // Alle ScheduledSlots dieser Inquiry canceln (via inquiryId)
      await tx.scheduledSlot.updateMany({
        where: { inquiryId: id, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
      });

      // Legacy: auch slot_inq_${id} canceln (falls von altem Confirm erstellt)
      await tx.scheduledSlot.updateMany({
        where: { id: `slot_inq_${id}`, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
      });

      // InquirySlots die CONFIRMED sind, auf DECLINED setzen
      await tx.inquirySlot.updateMany({
        where: { inquiryId: id, status: 'CONFIRMED' },
        data: { status: 'DECLINED' },
      });

      return inq;
    });

    return reply.send(updatedInquiry);
  });

  // POST /inquiry/:id/withdraw — Patient zieht Anfrage zurück (SENT/SEEN → WITHDRAWN)
  fastify.post('/inquiry/:id/withdraw', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Nur Patienten' });

    const { id } = request.params as { id: string };
    const inquiry = await fastify.prisma.inquiry.findUnique({
      where: { id },
      include: { patientRequest: true },
    });
    if (!inquiry) return reply.status(404).send({ error: 'Nicht gefunden' });
    if (inquiry.patientRequest.patientUserId !== patient.id) return reply.status(403).send({ error: 'Keine Berechtigung' });
    if (!['SENT', 'SEEN', 'COUNTER_PROPOSED'].includes(inquiry.status)) {
      return reply.status(409).send({ error: `Ungültiger Übergang: ${inquiry.status} → WITHDRAWN` });
    }

    const updated = await fastify.prisma.inquiry.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
    return reply.send(updated);
  });

  // ── Migration-Endpunkt ─────────────────────────────────────────────────────

  // POST /inquiry/migrate — idempotent: migriert bestehende BookingRequests → PatientRequest + Inquiry
  fastify.post('/inquiry/migrate', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });
    const patient = await resolvePatient(fastify, token);
    if (!patient) return reply.status(403).send({ error: 'Nur Patienten' });

    const bookings = await fastify.prisma.bookingRequest.findMany({
      where: { patientUserId: patient.id },
      orderBy: { createdAt: 'asc' },
    });

    let created = 0;
    let skipped = 0;

    for (const b of bookings) {
      const exists = await fastify.prisma.inquiry.findFirst({
        where: { patientRequest: { migrated: true }, therapistId: b.therapistId, patientName: b.patientName, heilmittel: b.heilmittel ?? '' },
      });
      if (exists) { skipped++; continue; }

      const inquiryStatus = (() => {
        switch (b.status) {
          case 'PENDING': return 'SENT';
          case 'CONFIRMED': return 'CONFIRMED';
          case 'DECLINED': return 'DECLINED';
          case 'CANCELLED': return 'CANCELLED';
          case 'EXPIRED': return 'EXPIRED';
          default: return 'EXPIRED';
        }
      })() as any;

      const responseDueAt = b.responseDueAt ?? addBusinessDays(b.createdAt, 2);

      await fastify.prisma.$transaction(async (tx) => {
        const pr = await tx.patientRequest.create({
          data: {
            patientUserId: patient.id,
            heilmittel: b.heilmittel ?? '',
            kassenart: b.kassenart ?? '',
            message: b.message ?? undefined,
            migrated: true,
          },
        });

        await tx.inquiry.create({
          data: {
            patientRequestId: pr.id,
            therapistId: b.therapistId,
            status: inquiryStatus,
            heilmittel: b.heilmittel ?? '',
            kassenart: b.kassenart ?? '',
            patientFreitext: b.message ?? undefined,
            patientName: b.patientName,
            patientEmail: b.patientEmail ?? undefined,
            patientPhone: b.patientPhone ?? undefined,
            ablehnungsgrund: b.declinedReason ?? undefined,
            respondedAt: b.respondedAt ?? undefined,
            responseDueAt,
            migrated: true,
            ...(b.status === 'CONFIRMED' && b.startsAt ? {
              confirmedDatum: b.startsAt,
              confirmedUhrzeitVon: b.startsAt.getHours() * 60 + b.startsAt.getMinutes(),
              confirmedUhrzeitBis: b.endsAt ? b.endsAt.getHours() * 60 + b.endsAt.getMinutes() : undefined,
            } : {}),
          },
        });
      });

      created++;
    }

    return reply.send({ created, skipped });
  });
}
