// Mo-first display order, key matches JS Date#getDay() (0=So..6=Sa).
export const WEEKDAY_OPTIONS = [
  { key: 1, label: 'Mo' },
  { key: 2, label: 'Di' },
  { key: 3, label: 'Mi' },
  { key: 4, label: 'Do' },
  { key: 5, label: 'Fr' },
  { key: 6, label: 'Sa' },
  { key: 0, label: 'So' },
];

// Generates individual slots for a recurring series. Each selected weekday
// gets its own chain, starting at its first occurrence on/after startDate
// and stepping forward by exactly `intervalWeeks * 7` calendar days via
// setDate — never via millisecond arithmetic, which would drift an hour
// across Germany's CET/CEST transitions. setHours is reapplied per
// occurrence so the wall-clock time of day never shifts either.
export function generateRecurringSlots({
  startDate,
  endDate,
  weekdays,
  times,
  durationMin,
  intervalWeeks = 1,
  now = new Date(),
}) {
  if (!startDate || !endDate || !Array.isArray(weekdays) || weekdays.length === 0
    || !Array.isArray(times) || times.length === 0) {
    return [];
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const results = [];

  for (const weekday of weekdays) {
    const first = new Date(start);
    const delta = (weekday - first.getDay() + 7) % 7;
    first.setDate(first.getDate() + delta);

    const occurrence = new Date(first);
    while (occurrence <= end) {
      for (const { hour, minute } of times) {
        const dt = new Date(occurrence);
        dt.setHours(hour, minute, 0, 0);
        if (dt > now) {
          results.push({ startsAt: dt.toISOString(), durationMin });
        }
      }
      occurrence.setDate(occurrence.getDate() + 7 * intervalWeeks);
    }
  }

  results.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return results;
}
