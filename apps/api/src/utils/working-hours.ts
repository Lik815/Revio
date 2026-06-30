// DST-sichere Zeitgeneratoren für Arbeitszeiten-Regeln.
// Der Materialisierer (materializeWorkingHours/pruneFutureWorkingHoursSlots)
// wurde im Rahmen des dynamischen Buchungssystems entfernt. Freie Zeitfenster
// werden jetzt live durch generateAvailableSlots (slot-generator.ts) berechnet.

export const DEFAULT_WORKING_HOURS_WINDOW_WEEKS = 8;

export type WorkingHoursRuleInput = {
  id: string;
  weekday: number; // 0-6, JS Date#getDay() convention (0=So..6=Sa)
  startMinute: number;
  endMinute: number;
  durationMin: number;    // Schrittweite für generateOccurrencesForRule (Referenz-Impl.)
  intervalMin: number | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type GeneratedOccurrence = {
  startsAt: Date;
  durationMin: number;
  workingHoursRuleId: string;
};

function timesOfDayForRule(rule: WorkingHoursRuleInput): { hour: number; minute: number }[] {
  const interval = rule.intervalMin ?? rule.durationMin;
  if (!interval || interval <= 0 || rule.endMinute < rule.startMinute) return [];
  const result: { hour: number; minute: number }[] = [];
  for (let m = rule.startMinute; m <= rule.endMinute; m += interval) {
    result.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return result;
}

// DST-sicheres Erzeugen konkreter Zeitpunkte für eine Regel im Fenster
// [windowStart, windowEnd]. Referenz-Implementierung für slot-generator.ts.
// weekly chain steps forward via setDate (never millisecond arithmetic, which
// would drift an hour across Germany's CET/CEST transitions).
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
