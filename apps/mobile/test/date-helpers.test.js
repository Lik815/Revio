process.env.TZ = 'Europe/Berlin';

import { describe, test, expect } from 'vitest';
import { isSameDay, startOfDay, startOfWeek, addDays, getIsoWeekNumber } from '../src/utils/app-utils.js';

describe('isSameDay', () => {
  test('true for the same calendar day at different times', () => {
    expect(isSameDay(new Date(2026, 5, 24, 8, 0), new Date(2026, 5, 24, 23, 59))).toBe(true);
  });

  test('false across a day boundary', () => {
    expect(isSameDay(new Date(2026, 5, 24, 23, 59), new Date(2026, 5, 25, 0, 0))).toBe(false);
  });

  test('false for the same day/month in different years', () => {
    expect(isSameDay(new Date(2025, 5, 24), new Date(2026, 5, 24))).toBe(false);
  });
});

describe('startOfDay', () => {
  test('zeroes out the time component', () => {
    const result = startOfDay(new Date(2026, 5, 24, 13, 45, 30));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getDate()).toBe(24);
  });
});

describe('startOfWeek', () => {
  test('a Wednesday rolls back to that week\'s Monday', () => {
    const wednesday = new Date(2026, 5, 24); // Mi, 24. Juni 2026
    const monday = startOfWeek(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(22);
  });

  test('a Sunday rolls back to the Monday of the same week, not the next one', () => {
    const sunday = new Date(2026, 5, 28); // So, 28. Juni 2026
    const monday = startOfWeek(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(22);
  });

  test('a Monday returns the same day', () => {
    const monday = new Date(2026, 5, 22);
    expect(startOfWeek(monday).getDate()).toBe(22);
  });
});

describe('getIsoWeekNumber', () => {
  test('Jan 4 is always in week 1 by ISO definition', () => {
    expect(getIsoWeekNumber(new Date(2026, 0, 4))).toBe(1);
  });

  test('matches a known reference week', () => {
    // Mi, 28. Mai 2025 falls in ISO week 22.
    expect(getIsoWeekNumber(new Date(2025, 4, 28))).toBe(22);
  });

  test('every day in the same Mo-So week reports the same week number', () => {
    const monday = startOfWeek(new Date(2026, 5, 24));
    const week = getIsoWeekNumber(monday);
    for (let i = 1; i < 7; i += 1) {
      expect(getIsoWeekNumber(addDays(monday, i))).toBe(week);
    }
  });

  test('late-December dates can belong to week 1 of the next ISO year', () => {
    // Do, 31. Dezember 2026 is in the same ISO week as Fr, 1. Januar 2027.
    expect(getIsoWeekNumber(new Date(2026, 11, 31))).toBe(getIsoWeekNumber(new Date(2027, 0, 1)));
  });
});

describe('addDays', () => {
  test('adds days forward across a month boundary', () => {
    const result = addDays(new Date(2026, 5, 29), 3);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(2);
  });

  test('supports negative offsets', () => {
    const result = addDays(new Date(2026, 5, 1), -1);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(31);
  });
});
