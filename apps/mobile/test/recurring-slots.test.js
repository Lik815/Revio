process.env.TZ = 'Europe/Berlin';

import { describe, test, expect } from 'vitest';
import { generateRecurringSlots } from '../src/utils/recurring-slots.js';

const FAR_PAST = new Date(2000, 0, 1);

function localHourMinute(isoString) {
  const d = new Date(isoString);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

describe('generateRecurringSlots — basic recurrence', () => {
  test('weekly Monday 09:00 for 8 weeks yields 8 occurrences, 7 days apart', () => {
    const start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const end = new Date(start);
    end.setDate(end.getDate() + 7 * 7); // 8th Monday

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(8);
    result.forEach((slot) => {
      expect(localHourMinute(slot.startsAt)).toEqual({ hour: 9, minute: 0 });
      expect(slot.durationMin).toBe(20);
    });
    for (let i = 1; i < result.length; i += 1) {
      const diffDays = (new Date(result[i].startsAt) - new Date(result[i - 1].startsAt)) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(7);
    }
  });

  test('multiple weekdays and multiple times over 2 weeks yields the full cross product', () => {
    const start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const end = new Date(2026, 0, 18); // Sun Jan 18 2026 (2 weeks)

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1, 3], // Mo, Mi
      times: [{ hour: 9, minute: 0 }, { hour: 14, minute: 0 }],
      durationMin: 30,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(8); // 2 days x 2 times x 2 weeks
  });

  test('intervalWeeks=2 spaces occurrences 14 days apart', () => {
    const start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const end = new Date(start);
    end.setDate(end.getDate() + 7 * 7); // 8 weeks span

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      intervalWeeks: 2,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(4);
    for (let i = 1; i < result.length; i += 1) {
      const diffDays = (new Date(result[i].startsAt) - new Date(result[i - 1].startsAt)) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(14);
    }
  });

  test('occurrences at or before "now" are excluded', () => {
    const start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const end = new Date(2026, 1, 9); // Mon Feb 9 2026 (6 Mondays total)
    const now = new Date(2026, 0, 20, 9, 30); // after the Jan 19 occurrence

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now,
    });

    expect(result).toHaveLength(3); // Jan 26, Feb 2, Feb 9
  });

  test('no matching weekdays in range returns an empty array', () => {
    const result = generateRecurringSlots({
      startDate: new Date(2026, 0, 5),
      endDate: new Date(2026, 0, 5),
      weekdays: [2], // Tuesday, range is a single Monday
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now: FAR_PAST,
    });
    expect(result).toEqual([]);
  });

  test('exact 50-occurrence boundary returns exactly 50', () => {
    const start = new Date(2026, 0, 5); // Mon Jan 5 2026
    const end = new Date(start);
    end.setDate(end.getDate() + 49 * 7); // 50th Monday

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(50);
  });
});

describe('generateRecurringSlots — DST safety (Germany CET/CEST)', () => {
  test('weekly Monday 09:00 stays at 09:00 across the March CET→CEST transition', () => {
    // Last Sunday of March 2026 = Mar 29 (clocks spring forward 02:00 -> 03:00)
    const start = new Date(2026, 2, 16); // Mon Mar 16 2026
    const end = new Date(2026, 3, 13); // Mon Apr 13 2026

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(5); // Mar 16, 23, 30, Apr 6, 13
    result.forEach((slot) => {
      expect(localHourMinute(slot.startsAt)).toEqual({ hour: 9, minute: 0 });
    });
  });

  test('weekly Monday 09:00 stays at 09:00 across the October CEST→CET transition', () => {
    // Last Sunday of October 2026 = Oct 25 (clocks fall back 03:00 -> 02:00)
    const start = new Date(2026, 9, 12); // Mon Oct 12 2026
    const end = new Date(2026, 10, 9); // Mon Nov 9 2026

    const result = generateRecurringSlots({
      startDate: start,
      endDate: end,
      weekdays: [1],
      times: [{ hour: 9, minute: 0 }],
      durationMin: 20,
      now: FAR_PAST,
    });

    expect(result).toHaveLength(5); // Oct 12, 19, 26, Nov 2, 9
    result.forEach((slot) => {
      expect(localHourMinute(slot.startsAt)).toEqual({ hour: 9, minute: 0 });
    });
  });
});
