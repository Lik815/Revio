import { describe, test, expect } from 'vitest';
import { mapApiTherapist } from '../src/mobile-utils.js';

// ---------- RED: mapApiTherapist must NOT map behandlungsbereiche from specializations ----------

describe('mapApiTherapist — behandlungsbereiche must not duplicate specializations', () => {
  test('behandlungsbereiche is empty when API sends no dedicated field', () => {
    const apiTherapist = {
      id: 'abc',
      specializations: ['Rücken', 'Sport'],
      behandlungsbereiche: undefined,
      treatmentAreas: undefined,
    };
    const result = mapApiTherapist(apiTherapist);
    // If behandlungsbereiche is wrongly mapped from specializations this will be ['Rücken', 'Sport']
    expect(result.behandlungsbereiche).toEqual([]);
  });

  test('behandlungsbereiche uses its own API field when present', () => {
    const apiTherapist = {
      id: 'abc',
      specializations: ['Rücken'],
      behandlungsbereiche: ['Manuelle Therapie', 'Krankengymnastik'],
    };
    const result = mapApiTherapist(apiTherapist);
    expect(result.behandlungsbereiche).toEqual(['Manuelle Therapie', 'Krankengymnastik']);
  });

  test('specializations are unaffected', () => {
    const apiTherapist = { id: 'abc', specializations: ['Rücken', 'Sport'] };
    const result = mapApiTherapist(apiTherapist);
    expect(result.specializations).toEqual(['Rücken', 'Sport']);
  });
});

// ---------- Deduplication guard (pure logic, tested inline) ----------

const normalizeList = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);

const listsEqual = (a, b) => {
  const left = normalizeList(a).sort();
  const right = normalizeList(b).sort();
  if (left.length !== right.length) return false;
  return left.every((item, i) => item === right[i]);
};

describe('listsEqual deduplication guard', () => {
  test('identical lists are equal', () => {
    expect(listsEqual(['Rücken', 'Sport'], ['Rücken', 'Sport'])).toBe(true);
  });

  test('different lists are not equal', () => {
    expect(listsEqual(['Rücken'], ['Sport'])).toBe(false);
  });

  test('empty list equals empty list', () => {
    expect(listsEqual([], [])).toBe(true);
  });

  test('case-insensitive comparison', () => {
    expect(listsEqual(['RÜCKEN'], ['rücken'])).toBe(true);
  });
});

describe('public profile: Behandlungsbereiche hidden when duplicate of Spezialisierungen', () => {
  test('therapistAreas is empty when it equals specializations', () => {
    const specializations = ['Rücken', 'Sport'];
    const rawAreas = ['Rücken', 'Sport'];
    const therapistAreas = listsEqual(rawAreas, specializations) ? [] : rawAreas;
    expect(therapistAreas).toEqual([]);
  });

  test('therapistAreas shown when genuinely different', () => {
    const specializations = ['Rücken'];
    const rawAreas = ['Manuelle Therapie'];
    const therapistAreas = listsEqual(rawAreas, specializations) ? [] : rawAreas;
    expect(therapistAreas).toEqual(['Manuelle Therapie']);
  });
});
