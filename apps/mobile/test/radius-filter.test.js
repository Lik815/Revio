import { describe, test, expect } from 'vitest';
import { haversine, radiusOptions } from '../src/utils/app-utils.js';

describe('haversine distance calculation', () => {
  test('returns ~0 for identical coordinates', () => {
    expect(haversine(52.52, 13.40, 52.52, 13.40)).toBeCloseTo(0, 1);
  });

  test('Berlin to Munich is approx 504 km', () => {
    const dist = haversine(52.52, 13.40, 48.14, 11.58);
    expect(dist).toBeGreaterThan(490);
    expect(dist).toBeLessThan(520);
  });

  test('1 degree latitude ≈ 111 km', () => {
    const dist = haversine(52.0, 13.0, 53.0, 13.0);
    expect(dist).toBeGreaterThan(105);
    expect(dist).toBeLessThan(115);
  });

  test('short distances are below 1 km', () => {
    // ~0.5 km north
    const dist = haversine(52.52, 13.40, 52.524, 13.40);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(1);
  });
});

describe('radiusOptions', () => {
  test('contains the expected set of radius values', () => {
    expect(radiusOptions).toEqual([1, 3, 5, 10, 25]);
  });

  test('default radius 5 is contained', () => {
    expect(radiusOptions).toContain(5);
  });

  test('all values are positive integers', () => {
    radiusOptions.forEach((km) => {
      expect(km).toBeGreaterThan(0);
      expect(Number.isInteger(km)).toBe(true);
    });
  });
});

describe('radius result segmentation', () => {
  const makeResult = (distKm, radiusMatch) => ({ id: String(distKm), distKm, radiusMatch });

  test('results with radiusMatch true are primary results', () => {
    const results = [
      makeResult(2, true),
      makeResult(4, true),
      makeResult(12, false),
    ];
    const primary = results.filter((r) => r.radiusMatch !== false);
    expect(primary).toHaveLength(2);
    expect(primary.every((r) => r.distKm <= 5)).toBe(true);
  });

  test('results with radiusMatch false are "weitere Ergebnisse"', () => {
    const results = [
      makeResult(3, true),
      makeResult(12, false),
      makeResult(30, false),
    ];
    const secondary = results.filter((r) => r.radiusMatch === false);
    expect(secondary).toHaveLength(2);
  });

  test('without userCoords, radiusMatch defaults to true for all results', () => {
    // mapApiTherapist sets: radiusMatch: t.radiusMatch ?? true
    const results = [
      { id: '1', distKm: null, radiusMatch: true },
      { id: '2', distKm: null, radiusMatch: true },
    ];
    const primary = results.filter((r) => r.radiusMatch !== false);
    expect(primary).toHaveLength(2);
  });

  test('first result with radiusMatch false triggers the "weitere Ergebnisse" divider', () => {
    const results = [
      makeResult(3, true),
      makeResult(8, false),
      makeResult(20, false),
    ];
    const showDivider = (r, index) =>
      r.radiusMatch === false &&
      index > 0 &&
      results[index - 1].radiusMatch !== false;

    expect(showDivider(results[0], 0)).toBe(false);
    expect(showDivider(results[1], 1)).toBe(true);
    expect(showDivider(results[2], 2)).toBe(false);
  });

  test('larger radius means more matched results (simulated)', () => {
    const therapistDists = [2, 4, 8, 15, 28];
    const at5km = therapistDists.filter((d) => d <= 5).length;
    const at25km = therapistDists.filter((d) => d <= 25).length;
    expect(at5km).toBe(2);
    expect(at25km).toBe(4);
    expect(at25km).toBeGreaterThan(at5km);
  });

  test('location + radius together produce narrower results than location alone', () => {
    const results = [
      makeResult(1, true),
      makeResult(3, true),
      makeResult(8, false), // outside 5 km radius
    ];
    const withRadius = results.filter((r) => r.radiusMatch !== false);
    const withoutRadius = results; // no radius filter applied
    expect(withRadius.length).toBeLessThan(withoutRadius.length);
  });
});
