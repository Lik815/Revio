import type { FastifyInstance } from 'fastify';

export const DEFAULT_WORKING_HOURS_WINDOW_WEEKS = 8;

export type WorkingHoursRuleInput = {
  id: string;
  weekday: number; // 0-6, JS Date#getDay() convention (0=So..6=Sa) — matches
  // WEEKDAY_OPTIONS in apps/mobile/src/utils/recurring-slots.js.
  startMinute: number;
  endMinute: number;
  durationMin: number;
  intervalMin: number | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type GeneratedOccurrence = {
  startsAt: Date;
  durationMin: number;
  workingHoursRuleId: string;
};

// Converts a single rule's [startMinute, endMinute] block into concrete
// times-of-day, stepping by intervalMin (defaulting to durationMin) —
// mirrors generateTimeBlock in apps/mobile/src/components/SeriesSlotComposer.js.
function timesOfDayForRule(rule: WorkingHoursRuleInput): { hour: number; minute: number }[] {
  const interval = rule.intervalMin ?? rule.durationMin;
  if (!interval || interval <= 0 || rule.endMinute < rule.startMinute) return [];
  const result: { hour: number; minute: number }[] = [];
  for (let m = rule.startMinute; m <= rule.endMinute; m += interval) {
    result.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return result;
}

// Generates concrete occurrences for one rule within [windowStart, windowEnd],
// skipping anything at or before `now`. Mirrors the DST-safe stepping in
// apps/mobile/src/utils/recurring-slots.js (generateRecurringSlots): the
// weekly chain steps forward via setDate (never millisecond arithmetic, which
// would drift an hour across Germany's CET/CEST transitions), and setHours is
// reapplied per occurrence so the wall-clock time of day never shifts either.
export function generateOccurrencesForRule(
  rule: WorkingHoursRuleInput,
  windowStart: Date,
  windowEnd: Date,
  now: Date = windowStart,
): GeneratedOccurrence[] {
  const times = timesOfDayForRule(rule);
  if (times.length === 0) return [];

  const rangeStartMs = Math.max(
    windowStart.getTime(),
    rule.effectiveFrom ? rule.effectiveFrom.getTime() : -Infinity,
  );
  const rangeEndMs = Math.min(
    windowEnd.getTime(),
    rule.effectiveUntil ? rule.effectiveUntil.getTime() : Infinity,
  );
  if (rangeStartMs > rangeEndMs) return [];
  const rangeStart = new Date(rangeStartMs);

  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  // `end` is the inclusive upper bound for both the day-stepping loop below
  // and each occurrence's own time-of-day check — it must stay extended to
  // end-of-day, not the raw (typically-midnight) rangeEndMs instant, or the
  // last day in the window loses every occurrence after 00:00.
  const end = new Date(rangeEndMs);
  end.setHours(23, 59, 59, 999);

  const first = new Date(start);
  const delta = (rule.weekday - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + delta);

  const results: GeneratedOccurrence[] = [];
  const occurrence = new Date(first);
  while (occurrence <= end) {
    for (const { hour, minute } of times) {
      const dt = new Date(occurrence);
      dt.setHours(hour, minute, 0, 0);
      if (dt > now && dt >= rangeStart && dt <= end) {
        results.push({ startsAt: dt, durationMin: rule.durationMin, workingHoursRuleId: rule.id });
      }
    }
    occurrence.setDate(occurrence.getDate() + 7);
  }
  return results;
}

// Rolling-window materializer: reads this therapist's active working-hours
// rules and ensures concrete AVAILABLE TherapistSlot rows exist for the next
// `windowWeeks`. Idempotent — re-running it never creates duplicates, since
// it pre-filters against existing startsAt times and falls back to the same
// P2002-as-skipped handling already used by POST /therapist/slots
// (apps/api/src/routes/booking.ts) for the rare concurrent-run race.
export async function materializeWorkingHours(
  fastify: FastifyInstance,
  therapistId: string,
  options: { windowWeeks?: number; now?: Date } = {},
): Promise<{ created: number; skipped: number }> {
  const now = options.now ?? new Date();
  const windowWeeks = options.windowWeeks ?? DEFAULT_WORKING_HOURS_WINDOW_WEEKS;
  const windowEnd = new Date(now.getTime() + windowWeeks * 7 * 24 * 60 * 60 * 1000);

  const rules = await fastify.prisma.therapistWorkingHoursRule.findMany({
    where: { therapistId, isActive: true },
  });
  if (rules.length === 0) return { created: 0, skipped: 0 };

  const occurrences = rules.flatMap((rule) => generateOccurrencesForRule(rule, now, windowEnd, now));
  if (occurrences.length === 0) return { created: 0, skipped: 0 };

  const existing = await fastify.prisma.therapistSlot.findMany({
    where: { therapistId, startsAt: { in: occurrences.map((o) => o.startsAt) } },
    select: { startsAt: true },
  });
  const existingTimes = new Set(existing.map((s) => s.startsAt.getTime()));
  const toCreate = occurrences.filter((o) => !existingTimes.has(o.startsAt.getTime()));
  if (toCreate.length === 0) return { created: 0, skipped: occurrences.length };

  try {
    await fastify.prisma.$transaction(
      toCreate.map((o) =>
        fastify.prisma.therapistSlot.create({
          data: {
            therapistId,
            startsAt: o.startsAt,
            durationMin: o.durationMin,
            source: 'WORKING_HOURS',
            workingHoursRuleId: o.workingHoursRuleId,
          },
        }),
      ),
    );
    return { created: toCreate.length, skipped: occurrences.length - toCreate.length };
  } catch (err: any) {
    // A concurrent materializer run (e.g. the periodic top-up job overlapping
    // with a manual save) created some of the same slots first — treat the
    // whole batch as skipped, same risk-acceptance as POST /therapist/slots.
    if (err.code !== 'P2002') throw err;
    return { created: 0, skipped: occurrences.length };
  }
}

// Deletes future, still-AVAILABLE slots that came from the working-hours
// materializer. Never touches BOOKED slots (excluded by the status filter)
// or manually-created slots (excluded by the source filter). Used before
// regenerating from a changed/replaced rule set.
export async function pruneFutureWorkingHoursSlots(
  fastify: FastifyInstance,
  therapistId: string,
  now: Date = new Date(),
): Promise<number> {
  const result = await fastify.prisma.therapistSlot.deleteMany({
    where: {
      therapistId,
      source: 'WORKING_HOURS',
      status: 'AVAILABLE',
      startsAt: { gt: now },
    },
  });
  return result.count;
}
