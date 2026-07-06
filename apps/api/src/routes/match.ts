import type { FastifyInstance } from 'fastify';

// ─── Scoring-Konstanten ───────────────────────────────────────────────────────

const W = {
  HEILMITTEL_MATCH: 40,
  HEILMITTEL_MISMATCH: -100, // disqualifiziert effektiv
  KASSENART_MATCH: 15,
  KASSENART_MISMATCH: -10,
  ZEITFENSTER_OVERLAP_PER_MIN: 0.1, // max ~20 Punkte bei 200 Min Overlap
  KAPAZITAET_VERFUEGBAR: 10,
  KAPAZITAET_VOLL: -20,
  BELEGUNGSFAKTOR_PER_POINT: 10, // (1 - belegungsfaktor) * 10
  QUALIFIKATION_NICHT_VERIFIZIERT: -25,
  SPRACHE_MATCH: 5,
  REVIEW_RATING_PER_STAR: 3, // (avgRating - 3) * 3, nur wenn >= 3 Reviews
  DISTANZ_NEAR_KM: 5,   // < 5 km: +8
  DISTANZ_FAR_KM: 20,   // > 20 km: -5
};

// Überlappungsminuten zwischen zwei Zeitfenstern.
function overlapMinutes(
  aVon: number, aBis: number,
  bVon: number, bBis: number,
): number {
  return Math.max(0, Math.min(aBis, bBis) - Math.max(aVon, bVon));
}

export async function matchRoutes(fastify: FastifyInstance) {
  /**
   * GET /match?patientRequestId=...
   *
   * Gibt eine sortierte Liste von Therapeuten zurück, die zur PatientRequest passen.
   * Nur der Patient, dem die Request gehört, darf sie abrufen.
   * Für jeden Therapeuten wird ein numerischer Score und Erklärungen berechnet.
   */
  fastify.get<{ Querystring: { patientRequestId: string } }>(
    '/match',
    async (request, reply) => {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });
      const patient = await fastify.prisma.user.findFirst({ where: { sessionToken: token, role: 'patient' } });
      if (!patient) return reply.status(403).send({ error: 'Nur Patienten können Matches abrufen' });

      const { patientRequestId } = request.query as { patientRequestId?: string };
      if (!patientRequestId) return reply.badRequest('patientRequestId fehlt');

      // PatientRequest laden (inkl. Zeitfenster und bestehende Inquiries)
      const patientRequest = await fastify.prisma.patientRequest.findUnique({
        where: { id: patientRequestId },
        include: {
          timeWindows: true,
          inquiries: { select: { id: true, therapistId: true, status: true } },
        },
      });

      if (!patientRequest) return reply.notFound('PatientRequest nicht gefunden');
      if (patientRequest.patientUserId !== patient.id) return reply.forbidden();

      const { heilmittel, kassenart, timeWindows } = patientRequest;

      // Alle APPROVED+sichtbaren Therapeuten laden (mit Sprachen, Kapazität, Reviews)
      const therapists = await fastify.prisma.therapist.findMany({
        where: {
          reviewStatus: 'APPROVED',
          isVisible: true,
          isPublished: true,
        },
        include: {
          capacityRule: true,
          workingHoursRules: { where: { isActive: true } },
          reviews: { select: { rating: true } },
        },
      });

      type Explanation = { signal: string; delta: number; detail?: string };

      const results: Array<{
        therapistId: string;
        therapistName: string;
        professionalTitle: string;
        photo: string | null;
        city: string;
        score: number;
        scoreNormalized: number;
        explanations: Explanation[];
        zeitfensterOverlapMinutes: number;
        kapazitaetVerfuegbar: boolean;
        belegungsfaktor: number;
        existingInquiryId: string | null;
      }> = [];

      for (const th of therapists) {
        const explanations: Explanation[] = [];
        let score = 0;

        // 1. Heilmittel
        const heilmittelOk = Array.isArray((th as any).heilmittel)
          ? (th as any).heilmittel.includes(heilmittel)
          : false;
        if (heilmittelOk) {
          score += W.HEILMITTEL_MATCH;
          explanations.push({ signal: 'HEILMITTEL_MATCH', delta: W.HEILMITTEL_MATCH });
        } else {
          score += W.HEILMITTEL_MISMATCH;
          explanations.push({ signal: 'HEILMITTEL_MISMATCH', delta: W.HEILMITTEL_MISMATCH, detail: `Therapeut bietet ${heilmittel} nicht an` });
          // Bei Heilmittel-Mismatch nicht weiter auswerten
          continue;
        }

        // 2. Kassenart
        const thKasse = (th as any).kassenart as string ?? '';
        const kassenartOk = thKasse === kassenart || thKasse === 'BOTH' || kassenart === '';
        if (kassenartOk) {
          score += W.KASSENART_MATCH;
          explanations.push({ signal: 'KASSENART_MATCH', delta: W.KASSENART_MATCH });
        } else {
          score += W.KASSENART_MISMATCH;
          explanations.push({ signal: 'KASSENART_MISMATCH', delta: W.KASSENART_MISMATCH, detail: `${thKasse} vs. ${kassenart}` });
        }

        // 3. Qualifikationsstatus
        const qualOk = (th as any).qualifikationenStatus === 'VERIFIZIERT';
        if (!qualOk) {
          score += W.QUALIFIKATION_NICHT_VERIFIZIERT;
          explanations.push({ signal: 'QUALIFIKATION_NICHT_VERIFIZIERT', delta: W.QUALIFIKATION_NICHT_VERIFIZIERT });
        }

        // 4. Zeitfenster-Überlappung
        let totalOverlap = 0;
        for (const tw of timeWindows) {
          for (const rule of (th as any).workingHoursRules ?? []) {
            if (rule.weekday === tw.weekday) {
              totalOverlap += overlapMinutes(tw.vonMinute, tw.bisMinute, rule.startMinute, rule.endMinute);
            }
          }
        }
        if (totalOverlap > 0) {
          const delta = Math.min(totalOverlap * W.ZEITFENSTER_OVERLAP_PER_MIN, 20);
          score += delta;
          explanations.push({ signal: 'ZEITFENSTER_OVERLAP', delta, detail: `${totalOverlap} Min Überlappung` });
        }

        // 5. Kapazität
        const cap = (th as any).capacityRule;
        let kapazitaetVerfuegbar = true;
        let belegungsfaktor = cap?.belegungsfaktor ?? 0.4;
        if (cap) {
          const openInquiries = await fastify.prisma.inquiry.count({
            where: { therapistId: th.id, status: { in: ['SENT', 'SEEN', 'COUNTER_PROPOSED'] } },
          });
          kapazitaetVerfuegbar = openInquiries < cap.maxAnfragenOffen
            && cap.laufendeNeuaufnahmenDieseWoche < cap.maxNeueSerienProWoche;

          if (kapazitaetVerfuegbar) {
            score += W.KAPAZITAET_VERFUEGBAR;
            explanations.push({ signal: 'KAPAZITAET_VERFUEGBAR', delta: W.KAPAZITAET_VERFUEGBAR });
          } else {
            score += W.KAPAZITAET_VOLL;
            explanations.push({ signal: 'KAPAZITAET_VOLL', delta: W.KAPAZITAET_VOLL });
          }

          // Belegungsfaktor: je freier, desto besser
          const belegunsgDelta = Math.round((1 - belegungsfaktor) * W.BELEGUNGSFAKTOR_PER_POINT);
          score += belegunsgDelta;
          explanations.push({ signal: 'BELEGUNGSFAKTOR', delta: belegunsgDelta, detail: `${Math.round(belegungsfaktor * 100)}% belegt` });
        }

        // 6. Review-Rating
        const reviews = (th as any).reviews ?? [];
        if (reviews.length >= 3) {
          const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
          const ratingDelta = Math.round((avg - 3) * W.REVIEW_RATING_PER_STAR);
          if (ratingDelta !== 0) {
            score += ratingDelta;
            explanations.push({ signal: 'REVIEW_RATING', delta: ratingDelta, detail: `Ø ${avg.toFixed(1)} (${reviews.length} Bewertungen)` });
          }
        }

        // 7. Bestehende Inquiry (falls Patient bereits angefragt hat)
        const existingInquiry = patientRequest.inquiries.find(
          (q) => q.therapistId === th.id && !['WITHDRAWN', 'EXPIRED', 'DECLINED', 'DECLINED_BY_PATIENT', 'AUTO_CLOSED', 'CANCELLED'].includes(q.status)
        );

        results.push({
          therapistId: th.id,
          therapistName: (th as any).fullName,
          professionalTitle: (th as any).professionalTitle,
          photo: (th as any).photoUrl ?? null,
          city: (th as any).city,
          score,
          scoreNormalized: 0, // wird unten gesetzt
          explanations,
          zeitfensterOverlapMinutes: totalOverlap,
          kapazitaetVerfuegbar,
          belegungsfaktor,
          existingInquiryId: existingInquiry?.id ?? null,
        });
      }

      // Score normalisieren (relativ zum besten)
      const maxScore = results.reduce((m, r) => Math.max(m, r.score), 0);
      for (const r of results) {
        r.scoreNormalized = maxScore > 0 ? Math.max(0, r.score / maxScore) : 0;
      }

      // Sortiert: höchster Score zuerst
      results.sort((a, b) => b.score - a.score);

      return reply.send({
        patientRequestId,
        results,
        generatedAt: new Date().toISOString(),
      });
    },
  );
}
