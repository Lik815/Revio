import { describe, test, expect } from 'vitest';
import {
  getTodayRange,
  getBookingStart,
  getBookingEnd,
  getTodayBookings,
  getNextTherapistBooking,
  computeTherapistDashboardStats,
} from '../src/utils/therapist-dashboard.js';

const NOW = new Date('2026-07-02T10:00:00.000Z');
const TODAY_EARLY = new Date('2026-07-02T07:00:00.000Z');
const TODAY_LATE = new Date('2026-07-02T17:00:00.000Z');
const YESTERDAY = new Date('2026-07-01T10:00:00.000Z');
const TOMORROW = new Date('2026-07-03T10:00:00.000Z');

function booking(overrides) {
  return { id: Math.random().toString(36), status: 'CONFIRMED', startsAt: TODAY_EARLY.toISOString(), patientName: 'Max Muster', ...overrides };
}

describe('getTodayRange', () => {
  test('start ist Mitternacht, end ist 23:59:59.999', () => {
    const { start, end } = getTodayRange(NOW);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });
});

describe('getBookingStart', () => {
  test('liest startsAt', () => {
    const b = booking({ startsAt: TOMORROW.toISOString() });
    expect(getBookingStart(b)).toEqual(TOMORROW);
  });

  test('fällt auf confirmedSlotAt zurück', () => {
    const b = { confirmedSlotAt: TOMORROW.toISOString() };
    expect(getBookingStart(b)).toEqual(TOMORROW);
  });

  test('null wenn kein Datumsfeld', () => {
    expect(getBookingStart({})).toBeNull();
    expect(getBookingStart(null)).toBeNull();
  });
});

describe('getBookingEnd', () => {
  test('liest endsAt wenn vorhanden', () => {
    const end = new Date('2026-07-02T08:00:00.000Z');
    const b = booking({ startsAt: TODAY_EARLY.toISOString(), endsAt: end.toISOString() });
    expect(getBookingEnd(b)).toEqual(end);
  });

  test('berechnet aus durationMin wenn kein endsAt', () => {
    const b = booking({ startsAt: TODAY_EARLY.toISOString(), slot: { durationMin: 60 } });
    const end = getBookingEnd(b);
    expect(end.getTime()).toBe(TODAY_EARLY.getTime() + 60 * 60_000);
  });

  test('default 20min wenn kein endsAt und kein durationMin', () => {
    const b = booking({ startsAt: TODAY_EARLY.toISOString() });
    const end = getBookingEnd(b);
    expect(end.getTime()).toBe(TODAY_EARLY.getTime() + 20 * 60_000);
  });

  test('null wenn kein start', () => {
    expect(getBookingEnd({})).toBeNull();
  });
});

describe('getTodayBookings', () => {
  test('leere Liste → leer', () => {
    expect(getTodayBookings([], NOW)).toEqual([]);
  });

  test('null/undefined → leer', () => {
    expect(getTodayBookings(null, NOW)).toEqual([]);
    expect(getTodayBookings(undefined, NOW)).toEqual([]);
  });

  test('filtert gestrige Buchungen', () => {
    const b = booking({ startsAt: YESTERDAY.toISOString() });
    expect(getTodayBookings([b], NOW)).toEqual([]);
  });

  test('schließt Buchungen von heute ein', () => {
    const b = booking({ startsAt: TODAY_EARLY.toISOString() });
    expect(getTodayBookings([b], NOW)).toHaveLength(1);
  });

  test('schließt morgige Buchungen aus', () => {
    const b = booking({ startsAt: TOMORROW.toISOString() });
    expect(getTodayBookings([b], NOW)).toEqual([]);
  });

  test('CANCELLED wird ausgeschlossen', () => {
    const b = booking({ startsAt: TODAY_EARLY.toISOString(), status: 'CANCELLED' });
    expect(getTodayBookings([b], NOW)).toEqual([]);
  });

  test('PENDING wird eingeschlossen', () => {
    const b = booking({ startsAt: TODAY_EARLY.toISOString(), status: 'PENDING' });
    expect(getTodayBookings([b], NOW)).toHaveLength(1);
  });

  test('mehrere Buchungen — nur heute', () => {
    const list = [
      booking({ startsAt: YESTERDAY.toISOString() }),
      booking({ startsAt: TODAY_EARLY.toISOString() }),
      booking({ startsAt: TODAY_LATE.toISOString() }),
      booking({ startsAt: TOMORROW.toISOString() }),
    ];
    expect(getTodayBookings(list, NOW)).toHaveLength(2);
  });
});

describe('getNextTherapistBooking', () => {
  test('leere Liste → null', () => {
    expect(getNextTherapistBooking([], NOW)).toBeNull();
  });

  test('nur vergangene → null', () => {
    const b = booking({ startsAt: YESTERDAY.toISOString() });
    expect(getNextTherapistBooking([b], NOW)).toBeNull();
  });

  test('gibt früheste zukünftige CONFIRMED zurück', () => {
    const b1 = booking({ startsAt: TOMORROW.toISOString() });
    const b2 = booking({ startsAt: new Date('2026-07-05T10:00:00.000Z').toISOString() });
    expect(getNextTherapistBooking([b2, b1], NOW)).toEqual(b1);
  });

  test('PENDING wird ignoriert', () => {
    const b = booking({ startsAt: TOMORROW.toISOString(), status: 'PENDING' });
    expect(getNextTherapistBooking([b], NOW)).toBeNull();
  });
});

describe('computeTherapistDashboardStats', () => {
  test('gibt leere Stats zurück wenn keine Buchungen', () => {
    const stats = computeTherapistDashboardStats({ bookings: [], workingHoursRules: [], blockedTimes: [], date: NOW });
    expect(stats.confirmedToday).toEqual([]);
    expect(stats.pendingToday).toEqual([]);
    expect(stats.nextBooking).toBeNull();
    expect(stats.utilizationPercent).toBe(0);
  });

  test('zählt heutige bestätigte und ausstehende Buchungen', () => {
    const bookings = [
      booking({ startsAt: TODAY_EARLY.toISOString(), status: 'CONFIRMED' }),
      booking({ startsAt: TODAY_LATE.toISOString(), status: 'PENDING' }),
      booking({ startsAt: TOMORROW.toISOString(), status: 'CONFIRMED' }),
    ];
    const stats = computeTherapistDashboardStats({ bookings, workingHoursRules: [], blockedTimes: [], date: NOW });
    expect(stats.confirmedToday).toHaveLength(1);
    expect(stats.pendingToday).toHaveLength(1);
  });

  test('nextBooking zeigt nächste CONFIRMED nach jetzt', () => {
    const bookings = [
      booking({ startsAt: YESTERDAY.toISOString(), status: 'CONFIRMED' }),
      booking({ id: 'next', startsAt: TOMORROW.toISOString(), status: 'CONFIRMED' }),
    ];
    const stats = computeTherapistDashboardStats({ bookings, workingHoursRules: [], blockedTimes: [], date: NOW });
    expect(stats.nextBooking?.id).toBe('next');
  });
});
