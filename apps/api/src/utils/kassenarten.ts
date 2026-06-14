const LEGACY_ALL_VALUES = new Set(['alle', 'alle kassen']);

function splitCsv(value: string) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function normalizeKassenarten(
  values: string[] | string | null | undefined,
) {
  const source = Array.isArray(values)
    ? values
    : typeof values === 'string'
    ? splitCsv(values)
    : [];

  const normalized = source
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  if (normalized.some((value) => LEGACY_ALL_VALUES.has(value))) {
    return ['gesetzlich', 'privat', 'selbstzahler'];
  }

  return normalized;
}

export function serializeKassenarten(values: string[] | string | null | undefined) {
  return normalizeKassenarten(values).join(', ');
}
