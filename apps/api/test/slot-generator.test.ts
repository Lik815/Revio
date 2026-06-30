process.env.TZ = 'Europe/Berlin';

import { describe, test, expect } from 'vitest';
import { computeAvailableSlots, type WorkingHoursRuleForSlots, type BlockedPeriod } from '../src/utils/slot-generator.js';

// Mo 2026-07-06 08:00 Europe/Berlin
const MON_0800 = new Date(2026, 6, 6, 8, 0, 0, 0);
// Hilfsfunktion: hh:mm-String aus Date
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function rule(overrides: Partial<WorkingHoursRuleForSlots> = {}): WorkingHoursRuleForSlots {
  return {
    weekday: 1, // Montag
    startMinute: 8 * 60,  // 08:00
    endMinute: 12 * 60,   // 12:00
    effectiveFrom: null,
    effectiveUntil: null,
    ...overrides,
  };
}

// Testbeispiel aus dem Ticket:
// Therapeut arbeitet 08:00–12:00 (Mo), KG = 20 Min.
// Blockzeit 10:00–10:30. Buchung 09:00–09:20.
// Erwartet: 08:00 08:20 08:40 09:20 09:40 10:30 10:50 11:10 11:30
describe('Ticket-Beispiel: 08:00–12:00, Blockzeit 10:00–10:30, Buchung 09:00–09:20, KG 20 Min', () => {
  const now = new Date(2026, 6, 6, 7, 0, 0, 0); // Mo 07:00 (vor Arbeitsbeginn)
  const from = new Date(2026, 6, 6, 0, 0, 0, 0);
  const to = new Date(2026, 6, 6, 23, 59, 0, 0);

  const blockedTimes: BlockedPeriod[] = [
    { startsAt: new Date(2026, 6, 6, 10, 0), endsAt: new Date(2026, 6, 6, 10, 30) },
  ];
  const bookings: BlockedPeriod[] = [
    { startsAt: new Date(2026, 6, 6, 9, 0), endsAt: new Date(2026, 6, 6, 9, 20) },
  ];

  const slots = computeAvailableSlots(
    [rule()],
    blockedTimes,
    bookings,
    20, 20,
    { from, to },
    now,
  );

  test('Anzahl freier Slots = 9', () => expect(slots).toHaveLength(9));
  test('Startzeiten entsprechen Ticket-Erwartung', () => {
    const times = slots.map((s) => hhmm(s.startsAt));
    expect(times).toEqual(['08:00', '08:20', '08:40', '09:20', '09:40', '10:30', '10:50', '11:10', '11:30']);
  });
  test('Endzeiten = startsAt + 20 Min', () => {
    slots.forEach((s) => {
      expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(20 * 60_000);
    });
  });
});

describe('Keine Regeln → leere Ergebnisliste', () => {
  test('leeres Ergebnis', () => {
    const slots = computeAvailableSlots(
      [], [], [],
      20, 20,
      { from: MON_0800, to: new Date(2026, 6, 6, 12, 0) },
      new Date(2026, 6, 6, 7, 0),
    );
    expect(slots).toHaveLength(0);
  });
});

describe('Slots in der Vergangenheit werden ausgeschlossen', () => {
  test('now nach Arbeitsbeginn → Slots vor now fehlen', () => {
    // now = 09:10 → 08:00 und 08:20 sind bereits vergangen, 08:40 auch (09:00 nach now? nein, 09:00 > 09:10 ist false)
    // now = 09:10 → nächster freier Start = 09:20 (wenn keine Buchung)
    const now = new Date(2026, 6, 6, 9, 10, 0, 0);
    const slots = computeAvailableSlots(
      [rule()], [], [],
      20, 20,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 6, 23, 59) },
      now,
    );
    expect(slots.every((s) => s.startsAt > now)).toBe(true);
    expect(hhmm(slots[0].startsAt)).toBe('09:20');
  });
});

describe('Blockzeit deckt gesamtes Fenster → keine Slots', () => {
  test('Blockzeit 08:00–12:00 → 0 Slots', () => {
    const blockedTimes: BlockedPeriod[] = [
      { startsAt: new Date(2026, 6, 6, 8, 0), endsAt: new Date(2026, 6, 6, 12, 0) },
    ];
    const slots = computeAvailableSlots(
      [rule()], blockedTimes, [],
      20, 20,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 6, 23, 59) },
      new Date(2026, 6, 6, 7, 0),
    );
    expect(slots).toHaveLength(0);
  });
});

describe('MLD 60 Min — Schrittweite = Dauer', () => {
  test('08:00–12:00, 60 Min → 08:00 09:00 10:00 11:00', () => {
    const slots = computeAvailableSlots(
      [rule()], [], [],
      60, 60,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 6, 23, 59) },
      new Date(2026, 6, 6, 7, 0),
    );
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['08:00', '09:00', '10:00', '11:00']);
  });
});

describe('Slot passt nicht mehr vollständig ins Fenster → wird ausgeschlossen', () => {
  test('11:50 Start + 20 Min endet um 12:10 > 12:00 → kein Slot um 11:50', () => {
    const slots = computeAvailableSlots(
      [rule()], [], [],
      20, 20,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 6, 23, 59) },
      new Date(2026, 6, 6, 7, 0),
    );
    const times = slots.map((s) => hhmm(s.startsAt));
    expect(times).not.toContain('11:50');
    expect(times[times.length - 1]).toBe('11:40');
  });
});

describe('Zwei überschneidende Regeln → keine Duplikate', () => {
  test('zwei identische Mo-08:00–12:00-Regeln → keine doppelten Slots', () => {
    const slots = computeAvailableSlots(
      [rule(), rule()], [], [],
      20, 20,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 6, 23, 59) },
      new Date(2026, 6, 6, 7, 0),
    );
    const times = slots.map((s) => hhmm(s.startsAt));
    expect(new Set(times).size).toBe(times.length);
  });
});

describe('Mehrere Wochentage', () => {
  test('Mo+Di Regeln → Slots auf beiden Tagen', () => {
    const slots = computeAvailableSlots(
      [
        rule({ weekday: 1 }),  // Mo
        rule({ weekday: 2 }),  // Di
      ],
      [], [],
      20, 20,
      { from: new Date(2026, 6, 6, 0, 0), to: new Date(2026, 6, 7, 23, 59) },
      new Date(2026, 6, 5, 0, 0), // So 00:00
    );
    const days = new Set(slots.map((s) => s.startsAt.getDay()));
    expect(days.has(1)).toBe(true); // Montag
    expect(days.has(2)).toBe(true); // Dienstag
  });
});
