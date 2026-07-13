// Gemeinsame Helfer für BookingRequestForm (Direktbuchung) und
// InquiryRequestForm (Serien-/Einzeltermin-Anfrage). Reine Funktionen ohne
// React-Abhängigkeiten — UI-Bausteine liegen in BookingFormShared.js.
import { getBaseUrl, kassenartOptions, TUNNEL_HEADERS } from '../../../utils/app-utils';

export function formatTime(isoString) {
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function formatSlot(startsAt, endsAt) {
  if (!startsAt) return '—';
  const start = new Date(startsAt);
  const date = start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
  if (endsAt) return `${date} · ${formatTime(startsAt)}–${formatTime(endsAt)} Uhr`;
  return `${date} · ${formatTime(startsAt)} Uhr`;
}

export function dateGroupKey(isoString) {
  return isoString.slice(0, 10);
}

export function dateGroupLabel(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function minutesFromIso(isoString) {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

// [{ dateKey, label, slots }] gruppiert nach Kalendertag, Reihenfolge erhalten.
export function groupSlotsByDate(slots) {
  const map = new Map();
  for (const slot of slots) {
    const key = dateGroupKey(slot.startsAt);
    if (!map.has(key)) map.set(key, { dateKey: key, label: dateGroupLabel(slot.startsAt), slots: [] });
    map.get(key).slots.push(slot);
  }
  return Array.from(map.values());
}

export function getDateRange(days = 14) {
  const from = new Date();
  const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── Wochen-Navigation (SlotPicker) ──────────────────────────────────────────

export const WEEK_DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function getThisWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function weekKey(monday) {
  return monday.toISOString().slice(0, 10);
}

export function getWeekEnd(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 7);
  return d;
}

export function formatWeekRange(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('de-DE', opts)} – ${end.toLocaleDateString('de-DE', opts)}`;
}

export function getWeekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// ── Formular-Daten ──────────────────────────────────────────────────────────

export function getInsuranceOptions() {
  return kassenartOptions.filter((opt) => opt.key != null);
}

// Heilmittel des Therapeuten auf Config-Optionen mappen (Key ODER Label kann
// im Therapeuten-Datensatz stehen), Duplikate entfernen.
export function deriveAvailableHeilmittel(therapist, heilmittelOptions) {
  return (Array.isArray(therapist?.heilmittel) ? therapist.heilmittel : [])
    .map((item) => {
      const option = heilmittelOptions.find((opt) => opt.key === item || opt.label === item);
      return option ?? { key: item, label: item };
    })
    .filter((option, index, arr) =>
      option?.key && arr.findIndex((candidate) => candidate.key === option.key) === index,
    );
}

// Versicherungsart beim ersten Mal automatisch ins Patientenprofil übernehmen
// (Formulare fragen sie nur ab, solange sie im Profil fehlt). Fire-and-forget:
// blockiert den Schrittwechsel nicht, Fehler sind unkritisch — beim nächsten
// Formular wird einfach erneut gefragt.
export function persistKassenartFirstTime({ authToken, knownKassenart, selectedKassenart, updatePatientProfile }) {
  if (knownKassenart || !selectedKassenart || !authToken) return;
  fetch(`${getBaseUrl()}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...TUNNEL_HEADERS, Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ kassenart: selectedKassenart }),
  }).then((res) => { if (res.ok) updatePatientProfile({ kassenart: selectedKassenart }); }).catch(() => {});
}
