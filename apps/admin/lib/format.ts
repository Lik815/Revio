export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function summarizeValues(values: string[]) {
  if (values.length === 0) return null;
  const [first, ...rest] = values;
  return rest.length > 0 ? `${first} +${rest.length}` : first;
}
