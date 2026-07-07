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
      timeWindows: z.array(z.object({
        weekday: z.number().int().min(0).max(6),
        vonMinute: z.number().int().min(0).max(1439),
        bisMinute: z.number().int().min(1).max(1440),
      })).min(0).max(14).default([]),
      wunschDatum: z.string().datetime().optional(),
      wunschUhrzeitVon: z.number().int().min(0).max(1439).optional(),
      wunschUhrzeitBis: z.number().int().min(1).max(1440).optional(),
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
            timeWindows, wunschDatum, wunschUhrzeitVon, wunschUhrzeitBis,
            prescription, therapistIds } = parsed.data;

    if (suchtyp === 'SERIE' && timeWindows.length === 0) {
      return reply.status(400).send({ error: 'Für eine Behandlungsserie sind Wunschzeiten erforderlich.' });
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
          timeWindows: {
            create: timeWindows.map((tw) => ({
              weekday: tw.weekday,
              vonMinute: tw.vonMinute,
              bisMinute: tw.bisMinute,
            })),
          },
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
        include: { timeWindows: true, prescription: true },
      });

      const inquiries = await Promise.all(therapists.map((t) =>
        tx.inquiry.create({
          data: {
            patientRequestId: pr.id,
            therapistId: t.id,
            status: 'SENT',
            heilmittel, kassenart, frequenz, anzahlTermine,
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
        })
      ));

      return { ...pr, inquiries };
    });

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
    });
    return reply.send(updated);
  });

  // POST /inquiry/:id/confirm — Therapeut bestätigt mit Datum+Uhrzeit
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

    // Überschneidungs-Check gegen bestehende ScheduledSlots
    const conflict = await fastify.prisma.scheduledSlot.findFirst({
      where: {
        therapistId: therapist.id,
        status: 'SCHEDULED',
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
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
          bookingRequestId: `inq_${id}`,
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

  // POST /inquiry/:id/decline — Therapeut lehnt ab
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
      // Prüfen ob Patient zu dieser Inquiry gehört
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
    const [updatedInquiry] = await fastify.prisma.$transaction([
      fastify.prisma.inquiry.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: parsed.success ? parsed.data.cancelReason as any : undefined,
          cancelActor: actor,
          cancelledAt: now,
        },
      }),
      // ScheduledSlot auf CANCELLED setzen
      fastify.prisma.scheduledSlot.updateMany({
        where: { id: `slot_inq_${id}` },
        data: { status: 'CANCELLED' },
      }),
    ]);

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
      // Schon migriert?
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
