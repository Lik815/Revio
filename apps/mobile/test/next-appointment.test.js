import { describe, test, expect } from 'vitest';
import { getNextPatientAppointment } from '../src/utils/app-utils.js';

const FUTURE = new Date(Date.now() + 86_400_000); // +1 day
const PAST = new Date(Date.now() - 86_400_000);   // -1 day
const NOW = new Date();

function apt(overrides) {
  return { id: Math.random().toString(), status: 'CONFIRMED', startsAt: FUTURE.toISOString(), ...overrides };
}

describe('getNextPatientAppointment', () => {
  test('leere Liste → null', () => {
    expect(getNextPatientAppointment([])).toBeNull();
  });

  test('null/undefined → null', () => {
    expect(getNextPatientAppointment(null)).toBeNull();
    expect(getNextPatientAppointment(undefined)).toBeNull();
  });

  test('nur vergangene Termine → null', () => {
    const appointments = [
      apt({ startsAt: PAST.toISOString() }),
      apt({ startsAt: new Date(Date.now() - 3_600_000).toISOString() }),
    ];
    expect(getNextPatientAppointment(appointments)).toBeNull();
  });

  test('CANCELLED wird ignoriert', () => {
    expect(getNextPatientAppointment([apt({ status: 'CANCELLED' })])).toBeNull();
  });

  test('DECLINED wird ignoriert', () => {
    expect(getNextPatientAppointment([apt({ status: 'DECLINED' })])).toBeNull();
  });

  test('EXPIRED wird ignoriert', () => {
    expect(getNextPatientAppointment([apt({ status: 'EXPIRED' })])).toBeNull();
  });

  test('CONFIRMED zukünftig → wird zurückgegeben', () => {
    const a = apt({ status: 'CONFIRMED' });
    expect(getNextPatientAppointment([a])).toBe(a);
  });

  test('PENDING zukünftig → wird zurückgegeben', () => {
    const a = apt({ status: 'PENDING' });
    expect(getNextPatientAppointment([a])).toBe(a);
  });

  test('mehrere kommende Termine → frühester wird gewählt', () => {
    const early = apt({ startsAt: new Date(Date.now() + 3_600_000).toISOString() });
    const late  = apt({ startsAt: new Date(Date.now() + 7_200_000).toISOString() });
    expect(getNextPatientAppointment([late, early])).toBe(early);
  });

  test('Fallback: slot.startsAt wird genutzt wenn startsAt fehlt', () => {
    const a = { id: '1', status: 'CONFIRMED', startsAt: null, slot: { startsAt: FUTURE.toISOString() } };
    expect(getNextPatientAppointment([a])).toBe(a);
  });

  test('Fallback: confirmedSlotAt wird genutzt wenn startsAt und slot.startsAt fehlen', () => {
    const a = { id: '1', status: 'CONFIRMED', startsAt: null, confirmedSlotAt: FUTURE.toISOString() };
    expect(getNextPatientAppointment([a])).toBe(a);
  });

  test('vergangener Termin via slot.startsAt → null', () => {
    const a = { id: '1', status: 'CONFIRMED', startsAt: null, slot: { startsAt: PAST.toISOString() } };
    expect(getNextPatientAppointment([a])).toBeNull();
  });

  test('now-Parameter überschreibt aktuelle Zeit', () => {
    const a = apt({ startsAt: new Date(2030, 0, 1).toISOString() });
    const farFuture = new Date(2031, 0, 1);
    expect(getNextPatientAppointment([a], farFuture)).toBeNull();
  });
});
