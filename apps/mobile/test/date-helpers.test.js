process.env.TZ = 'Europe/Berlin';

import { describe, test, expect } from 'vitest';
import { isSameDay, startOfDay, startOfWeek, addDays } from '../src/utils/app-utils.js';

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
