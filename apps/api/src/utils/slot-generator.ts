import type { FastifyInstance } from 'fastify';

export type AvailableSlotResult = {
  startsAt: Date;
  endsAt: Date;
};

export type WorkingHoursRuleForSlots = {
  weekday: number; // 0-6, JS Date#getDay() convention
  startMinute: number;
  endMinute: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type BlockedPeriod = {
  startsAt: Date;
  endsAt: Date;
};

// Reine Berechnungsfunktion (keine DB-Zugriffe) — direkt unit-testbar.
export function computeAvailableSlots(
  rules: WorkingHoursRuleForSlots[],
  blockedTimes: BlockedPeriod[],
  existingBookings: BlockedPeriod[],
  durationMin: number,
  stepMin: number,
  range: { from: Date; to: Date },
  now: Date,
): AvailableSlotResult[] {
  if (rules.length === 0) return [];

  const durationMs = durationMin * 60_000;
  const stepMs = stepMin * 60_000;
  const results: AvailableSlotResult[] = [];

  for (const rule of rules) {
    const ruleFrom = rule.effectiveFrom && rule.effectiveFrom > range.from ? rule.effectiveFrom : range.from;
    const ruleTo = rule.effectiveUntil && rule.effectiveUntil < range.to ? rule.effectiveUntil : range.to;
    if (ruleFrom >= ruleTo) continue;

    // DST-sicheres Tages-Stepping analog zu generateOccurrencesForRule (working-hours.ts):
    // setDate statt ms-Arithmetik verhindert Drift über CET/CEST-Übergänge.
    const dayStart = new Date(ruleFrom);
    dayStart.setHours(0, 0, 0, 0);

    const delta = (rule.weekday - dayStart.getDay() + 7) % 7;
    const firstDay = new Date(dayStart);
    firstDay.setDate(firstDay.getDate() + delta);

    const dayEnd = new Date(ruleTo);
    dayEnd.setHours(23, 59, 59, 999);

    const currentDay = new Date(firstDay);
    while (currentDay <= dayEnd) {
      const windowStart = new Date(currentDay);
      windowStart.setHours(Math.floor(rule.startMinute / 60), rule.startMinute % 60, 0, 0);
      const windowEnd = new Date(currentDay);
      windowEnd.setHours(Math.floor(rule.endMinute / 60), rule.endMinute % 60, 0, 0);

      // Sequentielles Scheduling: nach einer Blockzeit/Buchung wird der
      // nächste Slot direkt am Ende der Unterbrechung begonnen (nicht am
      // nächsten globalem Raster-Tick). Dadurch entstehen keine unnötigen
      // Lücken, und das Ergebnis entspricht dem Ticket-Beispiel.
      let slotStart = windowStart.getTime();
      while (slotStart + durationMs <= windowEnd.getTime()) {
        const slotStartDate = new Date(slotStart);
        const slotEndDate = new Date(slotStart + durationMs);

        // Vergangene Slots überspringen
        if (slotStartDate <= now) {
          slotStart += stepMs;
          continue;
        }

        // Prüfen ob eine Blockzeit oder Buchung diesen Kandidaten überlappt
        const allBlocks = [...blockedTimes, ...existingBookings];
        const overlap = allBlocks.find(
          (b) => b.startsAt < slotEndDate && b.endsAt > slotStartDate,
        );

        if (overlap) {
          // Direkt ans Ende der überlappenden Periode springen (nicht +stepMs)
          // damit kein buchbares Zeitfenster verloren geht.
          slotStart = overlap.endsAt.getTime();
          continue;
        }

        results.push({ startsAt: slotStartDate, endsAt: slotEndDate });
        slotStart += stepMs;
      }

      currentDay.setDate(currentDay.getDate() + 7);
    }
  }

  results.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // Duplikate (aus überschneidenden Regeln) entfernen
  const seen = new Set<number>();
  return results.filter((s) => {
    const key = s.startsAt.getTime();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type ResolvedServiceConfig = {
  // true, wenn eine TherapistService-Zeile existiert und explizit deaktiviert
  // wurde — dann darf die Leistung weder Slots erzeugen noch gebucht werden.
  disabled: boolean;
  durationMin: number;
  stepMin: number;
};

// Einheitliche Auflösung der Leistungsdauer — verwendet von generateAvailableSlots
// UND POST /bookings, damit "Leistung deaktiviert" an genau einer Stelle definiert ist.
// Regeln:
//   - TherapistService-Zeile vorhanden & isActive=false → disabled (keine Slots).
//   - TherapistService-Zeile vorhanden & isActive=true   → deren durationMin/slotIntervalMin.
//   - keine Zeile (Leistung nur über therapist.heilmittel-CSV angeboten) → defaultDurationMin.
export async function resolveServiceConfig(
  fastify: FastifyInstance,
  therapistId: string,
  heilmittelKey: string,
): Promise<ResolvedServiceConfig> {
  const serviceConfig = await fastify.prisma.therapistService.findUnique({
    where: { therapistId_heilmittelKey: { therapistId, heilmittelKey } },
  });

  if (serviceConfig && !serviceConfig.isActive) {
    return { disabled: true, durationMin: 0, stepMin: 0 };
  }

  let durationMin: number;
  if (serviceConfig && serviceConfig.durationMin > 0) {
    durationMin = serviceConfig.durationMin;
  } else {
    const heilmittelOption = await fastify.prisma.heilmittelOption.findUnique({
      where: { key: heilmittelKey },
    });
    durationMin = heilmittelOption?.defaultDurationMin ?? 20;
  }

  // TODO bufferAfterMin: TherapistService.bufferAfterMin ist im Schema vorhanden, wird aber
  // noch nicht angewendet. Plan: resolveServiceConfig um bufferAfterMin erweitern; in
  // generateAvailableSlots existingBookings mit [startsAt, endsAt + buffer] als BlockedPeriod
  // übergeben statt [startsAt, endsAt], sodass der nächste Slot erst nach dem Puffer beginnt.
  return {
    disabled: false,
    durationMin,
    stepMin: serviceConfig?.slotIntervalMin ?? durationMin,
  };
}

// DB-Wrapper: lädt alle benötigten Daten und ruft computeAvailableSlots auf.
export async function generateAvailableSlots(
  fastify: FastifyInstance,
  therapistId: string,
  heilmittelKey: string,
  range: { from: Date; to: Date },
  now: Date = new Date(),
): Promise<AvailableSlotResult[]> {
  const { from, to } = range;

  // 1. Dauer + Schrittweite auflösen. Deaktivierte Leistung → keine Slots.
  const { disabled, durationMin, stepMin } = await resolveServiceConfig(fastify, therapistId, heilmittelKey);
  if (disabled) return [];

  // 2. Arbeitszeiten, Blockzeiten, bestehende Buchungen laden
  const [rules, blockedTimes, bookings] = await Promise.all([
    fastify.prisma.therapistWorkingHoursRule.findMany({
      where: { therapistId, isActive: true },
    }),
    fastify.prisma.therapistBlockedTime.findMany({
      where: { therapistId, startsAt: { lt: to }, endsAt: { gt: from } },
    }),
    fastify.prisma.bookingRequest.findMany({
      where: {
        therapistId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const existingBookings = bookings
    .filter((b): b is { startsAt: Date; endsAt: Date } => b.startsAt !== null && b.endsAt !== null);

  return computeAvailableSlots(rules, blockedTimes, existingBookings, durationMin, stepMin, { from, to }, now);
}
