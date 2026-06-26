process.env.TZ = 'Europe/Berlin';

import { describe, test, expect } from 'vitest';
import { generateOccurrencesForRule, type WorkingHoursRuleInput } from '../src/utils/working-hours.js';

const FAR_PAST = new Date(2000, 0, 1);

function localHourMinute(d: Date) {
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function baseRule(overrides: Partial<WorkingHoursRuleInput> = {}): WorkingHoursRuleInput {
  return {
    id: 'rule-1',
    weekday: 1, // Monday
    startMinute: 9 * 60,
    endMinute: 9 * 60,
    durationMin: 20,
    intervalMin: null,
    effectiveFrom: null,
    effectiveUntil: null,
    ...overrides,
  };
}

describe('generateOccurrencesForRule — basic recurrence', () => {
  test('weekly Monday 09:00 for an 8-week window yields 8 occurrences, 7 days apart', () => {
    const windowStart = new Date(2026, 0, 5); // Mon Jan 5 2026
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 7 * 7); // 8th Monday

    const result = generateOccurrencesForRule(baseRule(), windowStart, windowEnd, FAR_PAST);

    expect(result).toHaveLength(8);
    result.forEach((o) => {
      expect(localHourMinute(o.startsAt)).toEqual({ hour: 9, minute: 0 });
      expect(o.durationMin).toBe(20);
      expect(o.workingHoursRuleId).toBe('rule-1');
    });
    for (let i = 1; i < result.length; i += 1) {
      const diffDays = (result[i].startsAt.getTime() - result[i - 1].startsAt.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(7);
    }
  });

  test('a time block with startMinute < endMinute produces multiple times-of-day per occurrence day', () => {
    const windowStart = new Date(2026, 0, 5); // Mon Jan 5 2026
    const windowEnd = new Date(2026, 0, 5); // single Monday only

    const result = generateOccurrencesForRule(
      baseRule({ startMinute: 8 * 60, endMinute: 9 * 60, durationMin: 20, intervalMin: 30 }),
      windowStart,
      windowEnd,
      FAR_PAST,
    );

    // 08:00, 08:30, 09:00
    expect(result).toHaveLength(3);
    expect(result.map((o) => localHourMinute(o.startsAt))).toEqual([
      { hour: 8, minute: 0 },
      { hour: 8, minute: 30 },
      { hour: 9, minute: 0 },
    ]);
  });

  test('two rules on the same weekday (morning + afternoon block) combine without overlap', () => {
    const windowStart = new Date(2026, 0, 5);
    const windowEnd = new Date(2026, 0, 5);

    const morning = generateOccurrencesForRule(
      baseRule({ id: 'morning', startMinute: 8 * 60, endMinute: 12 * 60, intervalMin: 60 }),
      windowStart, windowEnd, FAR_PAST,
    );
    const afternoon = generateOccurrencesForRule(
      baseRule({ id: 'afternoon', startMinute: 14 * 60, endMinute: 18 * 60, intervalMin: 60 }),
      windowStart, windowEnd, FAR_PAST,
    );

    expect(morning).toHaveLength(5); // 08,09,10,11,12
    expect(afternoon).toHaveLength(5); // 14,15,16,17,18
    expect(morning.every((o) => o.workingHoursRuleId === 'morning')).toBe(true);
    expect(afternoon.every((o) => o.workingHoursRuleId === 'afternoon')).toBe(true);
  });

  test('occurrences at or before "now" are excluded', () => {
    const windowStart = new Date(2026, 0, 5); // Mon Jan 5 2026
    const windowEnd = new Date(2026, 1, 9); // Mon Feb 9 2026 (6 Mondays total)
    const now = new Date(2026, 0, 20, 9, 30); // after the Jan 19 occurrence

    const result = generateOccurrencesForRule(baseRule(), windowStart, windowEnd, now);

    expect(result).toHaveLength(3); // Jan 26, Feb 2, Feb 9
  });

  test('endMinute before startMinute yields no occurrences', () => {
    const result = generateOccurrencesForRule(
      baseRule({ startMinute: 12 * 60, endMinute: 8 * 60 }),
      new Date(2026, 0, 5), new Date(2026, 0, 12), FAR_PAST,
    );
    expect(result).toEqual([]);
  });

  test('non-matching weekday in a single-day window returns an empty array', () => {
    const result = generateOccurrencesForRule(
      baseRule({ weekday: 2 }), // Tuesday rule
      new Date(2026, 0, 5), new Date(2026, 0, 5), // a single Monday
      FAR_PAST,
    );
    expect(result).toEqual([]);
  });
});

describe('generateOccurrencesForRule — effectiveFrom / effectiveUntil', () => {
  test('effectiveFrom in the middle of the window excludes earlier occurrences', () => {
    const windowStart = new Date(2026, 0, 5); // Mon Jan 5
    const windowEnd = new Date(2026, 1, 2); // Mon Feb 2 (5 Mondays: 5,12,19,26,2)
    const effectiveFrom = new Date(2026, 0, 19); // 3rd Monday

    const result = generateOccurrencesForRule(
      baseRule({ effectiveFrom }), windowStart, windowEnd, FAR_PAST,
    );

    expect(result).toHaveLength(3); // Jan 19, 26, Feb 2
  });

  test('effectiveUntil before windowEnd excludes later occurrences', () => {
    const windowStart = new Date(2026, 0, 5);
    const windowEnd = new Date(2026, 1, 2);
    const effectiveUntil = new Date(2026, 0, 19);

    const result = generateOccurrencesForRule(
      baseRule({ effectiveUntil }), windowStart, windowEnd, FAR_PAST,
    );

    expect(result).toHaveLength(3); // Jan 5, 12, 19
  });

  test('effectiveUntil before windowStart yields no occurrences', () => {
    const result = generateOccurrencesForRule(
      baseRule({ effectiveUntil: new Date(2025, 11, 1) }),
      new Date(2026, 0, 5), new Date(2026, 1, 2), FAR_PAST,
    );
    expect(result).toEqual([]);
  });
});

describe('generateOccurrencesForRule — DST safety (Germany CET/CEST)', () => {
  test('weekly Monday 09:00 stays at 09:00 across the March CET→CEST transition', () => {
    // Last Sunday of March 2026 = Mar 29 (clocks spring forward 02:00 -> 03:00)
    const windowStart = new Date(2026, 2, 16); // Mon Mar 16 2026
    const windowEnd = new Date(2026, 3, 13); // Mon Apr 13 2026

    const result = generateOccurrencesForRule(baseRule(), windowStart, windowEnd, FAR_PAST);

    expect(result).toHaveLength(5); // Mar 16, 23, 30, Apr 6, 13
    result.forEach((o) => expect(localHourMinute(o.startsAt)).toEqual({ hour: 9, minute: 0 }));
  });

  test('weekly Monday 09:00 stays at 09:00 across the October CEST→CET transition', () => {
    // Last Sunday of October 2026 = Oct 25 (clocks fall back 03:00 -> 02:00)
    const windowStart = new Date(2026, 9, 12); // Mon Oct 12 2026
    const windowEnd = new Date(2026, 10, 9); // Mon Nov 9 2026

    const result = generateOccurrencesForRule(baseRule(), windowStart, windowEnd, FAR_PAST);

    expect(result).toHaveLength(5); // Oct 12, 19, 26, Nov 2, 9
    result.forEach((o) => expect(localHourMinute(o.startsAt)).toEqual({ hour: 9, minute: 0 }));
  });
});
