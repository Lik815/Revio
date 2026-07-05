import { describe, test, expect, vi } from 'vitest';
import {
  getTodayRange,
  getBookingStart,
  getBookingEnd,
  getTodayBookings,
  getNextTherapistBooking,
  computeTherapistDashboardStats,
  isBookingActive,
  getBookingProgress,
  getBookingRemainingMs,
  formatDuration,
  getNextDayBookingAfter,
  getDayAgendaItems,
  getCurrentAgendaState,
  getNextFreeGap,
  getTotalBookedMinutes,
  formatTimeRange,
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

describe('isBookingActive', () => {
  test('laufender Termin → true', () => {
    const start = new Date(NOW.getTime() - 5 * 60_000);
    const end = new Date(NOW.getTime() + 15 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(isBookingActive(b, NOW)).toBe(true);
  });

  test('noch nicht begonnen → false', () => {
    const start = new Date(NOW.getTime() + 5 * 60_000);
    const end = new Date(NOW.getTime() + 25 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(isBookingActive(b, NOW)).toBe(false);
  });

  test('bereits beendet → false', () => {
    const start = new Date(NOW.getTime() - 25 * 60_000);
    const end = new Date(NOW.getTime() - 5 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(isBookingActive(b, NOW)).toBe(false);
  });
});

describe('getBookingProgress', () => {
  test('halbzeit → 0.5', () => {
    const start = new Date(NOW.getTime() - 10 * 60_000);
    const end = new Date(NOW.getTime() + 10 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(getBookingProgress(b, NOW)).toBeCloseTo(0.5);
  });

  test('vor Beginn → 0', () => {
    const start = new Date(NOW.getTime() + 10 * 60_000);
    const end = new Date(NOW.getTime() + 30 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(getBookingProgress(b, NOW)).toBe(0);
  });

  test('nach Ende → 1', () => {
    const start = new Date(NOW.getTime() - 30 * 60_000);
    const end = new Date(NOW.getTime() - 10 * 60_000);
    const b = booking({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    expect(getBookingProgress(b, NOW)).toBe(1);
  });
});

describe('getBookingRemainingMs', () => {
  test('gibt verbleibende Millisekunden zurück', () => {
    const end = new Date(NOW.getTime() + 8 * 60_000);
    const b = booking({ endsAt: end.toISOString() });
    expect(getBookingRemainingMs(b, NOW)).toBe(8 * 60_000);
  });

  test('vergangener Termin → 0', () => {
    const end = new Date(NOW.getTime() - 5 * 60_000);
    const b = booking({ endsAt: end.toISOString() });
    expect(getBookingRemainingMs(b, NOW)).toBe(0);
  });
});

describe('formatDuration', () => {
  test('nur Minuten', () => {
    expect(formatDuration(8 * 60_000)).toBe('8 Min.');
  });

  test('nur Stunden', () => {
    expect(formatDuration(120 * 60_000)).toBe('2 Std.');
  });

  test('Stunden und Minuten', () => {
    expect(formatDuration(68 * 60_000)).toBe('1 Std. 8 Min.');
  });

  test('rundet auf volle Minuten auf', () => {
    expect(formatDuration(30_000)).toBe('1 Min.');
  });
});

describe('getNextDayBookingAfter', () => {
  const A_START = new Date('2026-07-02T08:00:00.000Z');
  const B_START = new Date('2026-07-02T09:00:00.000Z');
  const C_START = new Date('2026-07-02T10:00:00.000Z');

  const a = { id: 'a', status: 'CONFIRMED', startsAt: A_START.toISOString() };
  const b = { id: 'b', status: 'CONFIRMED', startsAt: B_START.toISOString() };
  const c = { id: 'c', status: 'CONFIRMED', startsAt: C_START.toISOString() };
  const pending = { id: 'p', status: 'PENDING', startsAt: B_START.toISOString() };

  test('gibt nächsten CONFIRMED nach aktuellem zurück', () => {
    expect(getNextDayBookingAfter([a, b, c], a)).toEqual(b);
  });

  test('letzter Termin → null', () => {
    expect(getNextDayBookingAfter([a, b, c], c)).toBeNull();
  });

  test('PENDING wird ignoriert', () => {
    expect(getNextDayBookingAfter([a, pending], a)).toBeNull();
  });

  test('leere Liste → null', () => {
    expect(getNextDayBookingAfter([], a)).toBeNull();
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

// ─── Tagesagenda-Helpers ──────────────────────────────────────────────────────

// Minimale Arbeitszeitsregel fuer einen fiktiven Wochentag (0 = Sonntag)
// NOW ist 2026-07-02 (Donnerstag = weekday 4)
const WORK_RULE = {
  isActive: true,
  weekday: NOW.getDay(), // Donnerstag
  startMinute: 7 * 60,   // 07:00
  endMinute: 18 * 60,    // 18:00
};

function makeBookingAt(isoStart, durationMin = 20, overrides = {}) {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return {
    id: Math.random().toString(36).slice(2),
    status: 'CONFIRMED',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    patientName: 'Demo Patient',
    heilmittel: 'KG',
    ...overrides,
  };
}

describe('getDayAgendaItems', () => {
  test('ohne Arbeitszeiten → leere Liste', () => {
    const bookings = [makeBookingAt('2026-07-02T07:00:00.000Z')];
    const items = getDayAgendaItems({ bookings, workingHoursRules: [], blockedTimes: [], date: NOW });
    expect(items).toHaveLength(0);
  });

  test('CONFIRMED-Buchung erscheint als booking-Item', () => {
    const b = makeBookingAt('2026-07-02T08:00:00.000Z', 20, { status: 'CONFIRMED' });
    const items = getDayAgendaItems({ bookings: [b], workingHoursRules: [WORK_RULE], blockedTimes: [], date: NOW });
    const bookingItems = items.filter((i) => i.type === 'booking');
    expect(bookingItems.length).toBeGreaterThanOrEqual(1);
    expect(bookingItems[0].status).toBe('CONFIRMED');
  });

  test('PENDING-Buchung erscheint als booking-Item mit status PENDING', () => {
    const b = makeBookingAt('2026-07-02T09:00:00.000Z', 20, { status: 'PENDING' });
    const items = getDayAgendaItems({ bookings: [b], workingHoursRules: [WORK_RULE], blockedTimes: [], date: NOW });
    const pending = items.filter((i) => i.type === 'booking' && i.status === 'PENDING');
    expect(pending).toHaveLength(1);
  });

  test('freie Luecke erscheint als free-Item', () => {
    // Buchung von 10:00–10:20 bei Arbeitszeit 07:00–18:00 → muss Luecken vor/nach geben
    const b = makeBookingAt('2026-07-02T10:00:00.000Z', 20);
    const items = getDayAgendaItems({ bookings: [b], workingHoursRules: [WORK_RULE], blockedTimes: [], date: NOW });
    const freeItems = items.filter((i) => i.type === 'free');
    expect(freeItems.length).toBeGreaterThan(0);
  });

  test('Items sind nach startsAt sortiert', () => {
    const b1 = makeBookingAt('2026-07-02T09:00:00.000Z', 20);
    const b2 = makeBookingAt('2026-07-02T08:00:00.000Z', 20);
    const items = getDayAgendaItems({ bookings: [b1, b2], workingHoursRules: [WORK_RULE], blockedTimes: [], date: NOW });
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startsAt.getTime()).toBeGreaterThanOrEqual(items[i - 1].startsAt.getTime());
    }
  });

  test('blocked-Zeiten erscheinen nicht als eigene Zeilen', () => {
    const bt = { startsAt: '2026-07-02T11:00:00.000Z', endsAt: '2026-07-02T12:00:00.000Z' };
    const items = getDayAgendaItems({ bookings: [], workingHoursRules: [WORK_RULE], blockedTimes: [bt], date: NOW });
    expect(items.filter((i) => i.type === 'blocked')).toHaveLength(0);
  });
});

describe('getCurrentAgendaState', () => {
  const BASE = new Date('2026-07-02T09:00:00.000Z');

  function freeItem(startsAt, endsAt) {
    return { type: 'free', startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
  }
  function bookingItem(startsAt, endsAt, status = 'CONFIRMED', id = 'b1') {
    return { type: 'booking', booking: { id }, startsAt: new Date(startsAt), endsAt: new Date(endsAt), status };
  }

  test('aktiver Termin wird erkannt', () => {
    const item = bookingItem('2026-07-02T08:50:00.000Z', '2026-07-02T09:10:00.000Z');
    const { activeItem, isFree } = getCurrentAgendaState([item], BASE);
    expect(activeItem).toBe(item);
    expect(isFree).toBe(false);
  });

  test('Jetzt frei wenn kein Termin laeuft', () => {
    const item = bookingItem('2026-07-02T10:00:00.000Z', '2026-07-02T10:20:00.000Z');
    const { activeItem, isFree } = getCurrentAgendaState([item], BASE);
    expect(activeItem).toBeNull();
    expect(isFree).toBe(true);
  });

  test('naechster Termin wird korrekt erkannt', () => {
    const past = bookingItem('2026-07-02T07:00:00.000Z', '2026-07-02T07:20:00.000Z', 'CONFIRMED', 'past');
    const next = bookingItem('2026-07-02T10:00:00.000Z', '2026-07-02T10:20:00.000Z', 'CONFIRMED', 'next');
    const { nextItem } = getCurrentAgendaState([past, next], BASE);
    expect(nextItem?.booking?.id).toBe('next');
  });

  test('leere Liste → isFree true, keine aktiven/naechsten Items', () => {
    const state = getCurrentAgendaState([], BASE);
    expect(state.isFree).toBe(true);
    expect(state.activeItem).toBeNull();
    expect(state.nextItem).toBeNull();
  });
});

describe('getNextFreeGap', () => {
  const NOW_GAP = new Date('2026-07-02T09:00:00.000Z');

  test('gibt naechste zukuenftige freie Luecke zurueck', () => {
    const past = { type: 'free', startsAt: new Date('2026-07-02T07:00:00.000Z'), endsAt: new Date('2026-07-02T08:00:00.000Z') };
    const future = { type: 'free', startsAt: new Date('2026-07-02T10:00:00.000Z'), endsAt: new Date('2026-07-02T11:00:00.000Z') };
    expect(getNextFreeGap([past, future], NOW_GAP)).toBe(future);
  });

  test('vergangene Luecke wird uebersprungen', () => {
    const past = { type: 'free', startsAt: new Date('2026-07-02T07:00:00.000Z'), endsAt: new Date('2026-07-02T08:00:00.000Z') };
    expect(getNextFreeGap([past], NOW_GAP)).toBeNull();
  });

  test('leere Liste → null', () => {
    expect(getNextFreeGap([], NOW_GAP)).toBeNull();
  });

  test('booking-Items werden ignoriert', () => {
    const bItem = { type: 'booking', startsAt: new Date('2026-07-02T10:00:00.000Z'), endsAt: new Date('2026-07-02T10:20:00.000Z') };
    expect(getNextFreeGap([bItem], NOW_GAP)).toBeNull();
  });
});

describe('getTotalBookedMinutes', () => {
  test('summiert Minuten aller CONFIRMED-Buchungen des Tages', () => {
    const b1 = makeBookingAt('2026-07-02T08:00:00.000Z', 20);
    const b2 = makeBookingAt('2026-07-02T09:00:00.000Z', 45);
    const total = getTotalBookedMinutes([b1, b2], NOW);
    expect(total).toBe(65);
  });

  test('PENDING zaehlt nicht als Arbeitszeit', () => {
    const confirmed = makeBookingAt('2026-07-02T08:00:00.000Z', 20, { status: 'CONFIRMED' });
    const pending = makeBookingAt('2026-07-02T09:00:00.000Z', 30, { status: 'PENDING' });
    expect(getTotalBookedMinutes([confirmed, pending], NOW)).toBe(20);
  });

  test('Buchungen anderer Tage werden nicht gezaehlt', () => {
    const today = makeBookingAt('2026-07-02T08:00:00.000Z', 20);
    const other = makeBookingAt('2026-07-01T08:00:00.000Z', 60);
    expect(getTotalBookedMinutes([today, other], NOW)).toBe(20);
  });

  test('leere Liste → 0', () => {
    expect(getTotalBookedMinutes([], NOW)).toBe(0);
  });

  test('null/undefined → 0', () => {
    expect(getTotalBookedMinutes(null, NOW)).toBe(0);
    expect(getTotalBookedMinutes(undefined, NOW)).toBe(0);
  });
});

describe('formatTimeRange', () => {
  test('gibt HH:MM–HH:MM zurueck', () => {
    const s = new Date('2026-07-02T09:20:00.000Z');
    const e = new Date('2026-07-02T10:05:00.000Z');
    const result = formatTimeRange(s, e);
    expect(result).toContain('–');
    expect(result.split('–')).toHaveLength(2);
  });

  test('beide Zeitteile sind nicht leer', () => {
    const s = new Date('2026-07-02T08:00:00.000Z');
    const e = new Date('2026-07-02T08:20:00.000Z');
    const [from, to] = formatTimeRange(s, e).split('–');
    expect(from.trim()).toBeTruthy();
    expect(to.trim()).toBeTruthy();
  });
});
