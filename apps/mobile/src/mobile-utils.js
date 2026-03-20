const allSuggestions = [
  'Rückenschmerzen', 'Kniereha', 'Sportphysiotherapie', 'Schulterrehabilitation',
  'Nackenschmerzen', 'Hüftreha', 'Fußtherapie', 'Handtherapie',
  'Manualtherapie', 'Orthopädische Rehabilitation', 'Neurologische Rehabilitation',
  'Postoperative Reha', 'Lymphdrainage', 'Vojta-Therapie', 'Bobath-Therapie',
  'Kinesiotaping', 'Osteopathie', 'Dry Needling', 'Beckenbodentherapie',
  'Atemtherapie', 'Entspannungstherapie', 'Pädiatrische Physiotherapie',
  'Wirbelsäulentherapie', 'Triggerpunkt-Therapie', 'Geriatrische Rehabilitation',
  'Aquatherapie', 'Krankengymnastik', 'Rückentherapie', 'Physiotherapie'
];

const quickChips = [
  { label: 'Rückenschmerzen', keywords: ['rücken', 'rückenschmerzen', 'rückentherapie', 'wirbelsäule', 'wirbelsäulentherapie', 'haltung'] },
  { label: 'Kniereha', keywords: ['knie', 'kniereha', 'knieschmerzen'] },
  { label: 'Sportphysiotherapie', keywords: ['sport', 'sportphysiotherapie', 'sportverletzung', 'sportreha'] },
  { label: 'Neurologische Rehabilitation', keywords: ['neurologie', 'neurologisch', 'neurologische rehabilitation', 'bobath', 'vojta', 'bobath-therapie', 'vojta-therapie'] },
  { label: 'Schulterrehabilitation', keywords: ['schulter', 'schulterrehabilitation', 'nackenschmerzen', 'nacken'] }
];

const tabs = [
  { key: 'discover', labelKey: 'tabSearch', icon: '⌕' },
  { key: 'favorites', labelKey: 'tabFavorites', icon: '♡' },
  { key: 'therapist', labelKey: 'tabTherapist', icon: '＋' },
  { key: 'options', labelKey: 'tabOptions', icon: '☰' }
];

const kassenartOptions = [
  { key: null, label: 'Alle' },
  { key: 'gesetzlich', label: 'Gesetzlich' },
  { key: 'privat', label: 'Privat' },
  { key: 'selbstzahler', label: 'Selbstzahler' }
];

const fortbildungOptions = [
  { key: 'MT', label: 'MT – Manuelle Therapie' },
  { key: 'Bobath', label: 'Neurologie (Bobath, PNF)' },
  { key: 'KGG', label: 'KGG – Krankengymnastik am Gerät' },
  { key: 'MLD', label: 'MLD – Manuelle Lymphdrainage' }
];

const regSpecOptions = [
  'Rückenschmerzen', 'Kniereha', 'Schulterrehabilitation', 'Nackenschmerzen', 'Hüftreha', 'Fußtherapie',
  'Sportphysiotherapie', 'Orthopädische Rehabilitation', 'Neurologische Rehabilitation',
  'Manualtherapie', 'Postoperative Reha', 'Lymphdrainage', 'Beckenbodentherapie',
  'Wirbelsäulentherapie', 'Handtherapie', 'Pädiatrische Physiotherapie',
  'Geriatrische Rehabilitation', 'Atemtherapie', 'Krankengymnastik',
  'Osteopathie', 'Kinesiotaping', 'Dry Needling', 'Triggerpunkt-Therapie',
  'Vojta-Therapie', 'Bobath-Therapie', 'Aquatherapie', 'Entspannungstherapie'
];

const LANGUAGE_MAP = {
  DE: 'Deutsch',
  EN: 'Englisch',
  FR: 'Französisch',
  ES: 'Spanisch',
  IT: 'Italienisch',
  TR: 'Türkisch',
  AR: 'Arabisch',
  PL: 'Polnisch',
  RU: 'Russisch',
  SR: 'Serbisch',
};

const PROFILE_FIELD_LABELS = {
  fullName: 'Name',
  professionalTitle: 'Berufsbezeichnung',
  bio: 'Kurzbeschreibung',
  specializations: 'Spezialisierungen',
  languages: 'Sprachen',
};

const GENERIC_SEARCH_LABELS = ['physiotherapie', 'physio', 'therapeut', 'physiotherapeut', 'krankengymnastik'];

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const REG_STEPS = 5;
const languageOptions = Object.keys(LANGUAGE_MAP);

const getBaseUrl = () => BASE_URL;

const parseStringOrArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeLanguageCode = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
};

const normalizeLanguageCodes = (values) =>
  parseStringOrArray(values)
    .map(normalizeLanguageCode)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

const getLangLabel = (code) => LANGUAGE_MAP[normalizeLanguageCode(code)] ?? code;

const mapApiTherapist = (t) => ({
  id: t.id,
  fullName: t.fullName,
  professionalTitle: t.professionalTitle,
  specializations: parseStringOrArray(t.specializations),
  languages: normalizeLanguageCodes(t.languages),
  homeVisit: t.homeVisit ?? false,
  isVisible: t.isVisible ?? true,
  availability: t.availability ?? '',
  city: t.city ?? '',
  bio: t.bio ?? '',
  kassenart: t.kassenart ?? null,
  fortbildungen: parseStringOrArray(t.certifications),
  verifiziert: true,
  behandlungsbereiche: parseStringOrArray(t.specializations),
  verfügbareZeiten: '',
  website: '',
  photo: t.photo || `https://i.pravatar.cc/96?u=${t.id}`,
  practices: (t.practices ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    city: p.city,
    address: p.address ?? '',
    phone: p.phone ?? '',
    hours: p.hours ?? '',
    description: p.description ?? '',
    lat: p.lat,
    lng: p.lng,
    logo: p.logo ?? null,
    photos: p.photos ?? [],
  })),
});

const normalizeTherapistProfile = (therapist) => {
  if (!therapist) return therapist;
  return {
    ...therapist,
    languages: normalizeLanguageCodes(therapist.languages),
  };
};

const formatMissingProfileFields = (fields = []) =>
  fields.map((field) => PROFILE_FIELD_LABELS[field] ?? field);

const getPrimaryPractice = (therapist) => therapist?.practices?.[0] ?? null;

const getPracticeInitials = (name = '') =>
  name.split(' ').filter((w) => w.length > 2).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || name.charAt(0).toUpperCase();

const getSearchMatchLabel = (therapist, searchQuery) => {
  const q = (searchQuery ?? '').trim().toLowerCase();
  if (!q || GENERIC_SEARCH_LABELS.includes(q)) {
    return 'Passend fuer deine Suche';
  }

  const fullName = (therapist.fullName ?? '').toLowerCase();
  if (fullName.includes(q)) return 'Name passt direkt';

  const specializations = (therapist.specializations ?? []).map((s) => s.toLowerCase());
  if (specializations.some((s) => s.includes(q) || q.includes(s))) return 'Spezialisierung passt';

  const practices = (therapist.practices ?? []).map((p) => (p.name ?? '').toLowerCase());
  if (practices.some((name) => name.includes(q))) return 'Praxis passt';

  const bio = (therapist.bio ?? '').toLowerCase();
  if (bio.includes(q)) return 'Beschreibung passt';

  return 'Guter Treffer';
};

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDist = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export {
  REG_STEPS,
  allSuggestions,
  fortbildungOptions,
  formatDist,
  formatMissingProfileFields,
  getBaseUrl,
  getLangLabel,
  getPracticeInitials,
  getPrimaryPractice,
  getSearchMatchLabel,
  haversine,
  kassenartOptions,
  languageOptions,
  mapApiTherapist,
  normalizeLanguageCodes,
  normalizeTherapistProfile,
  quickChips,
  regSpecOptions,
  tabs,
};
