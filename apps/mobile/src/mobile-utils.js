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

const COLORS = {
  light: {
    background: '#F5F7F8',
    bgElevated: '#FFFFFF',
    text: '#1C2B33',
    textMuted: '#6B838E',
    primary: '#3E6271',
    primaryBg: '#EBF2F5',
    accent: '#5A9E8E',
    accentBg: '#EAF4F1',
    card: '#FFFFFF',
    border: '#D4DEE3',
    muted: '#A7B6BE',
    mutedBg: '#EDF2F4',
    nav: '#FFFFFF',
    success: '#5A9E8E',
    successBg: '#EAF4F1',
    error: '#B94040',
    errorBg: '#FBEAEA',
    warning: '#8A6000',
    warningBg: '#FEF5DC',
    saved: '#D0526A',
  },
  dark: {
    background: '#111A1F',
    bgElevated: '#1A2630',
    text: '#E8EEF1',
    textMuted: '#7A9099',
    primary: '#6B8FA0',
    primaryBg: '#1A2E38',
    accent: '#6FB8A8',
    accentBg: '#1A2E2A',
    card: '#1A2630',
    border: '#2A3A44',
    muted: '#7A9099',
    mutedBg: '#1E2E38',
    nav: '#151F26',
    success: '#6FB8A8',
    successBg: '#1A2E2A',
    error: '#D46060',
    errorBg: '#2E1A1A',
    warning: '#C49A30',
    warningBg: '#2A2010',
    saved: '#E07090',
  },
};

const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const RADIUS = {
  sm: 10,
  md: 16,
  lg: 20,
  full: 999,
};

const SHADOW = {
  card: {
    shadowColor: '#1C2B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#1C2B33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

const TYPE = {
  xl: { fontSize: 26, fontWeight: '800', lineHeight: 34 },
  lg: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  meta: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
};

const tabs = [
  { key: 'discover', labelKey: 'tabSearch', icon: 'search' },
  { key: 'favorites', labelKey: 'tabFavorites', icon: 'heart' },
  { key: 'therapist', labelKey: 'tabTherapist', icon: 'person' },
  { key: 'options', labelKey: 'tabOptions', icon: 'settings' }
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
  PT: 'Portugiesisch',
  NL: 'Niederländisch',
  UK: 'Ukrainisch',
  HR: 'Kroatisch',
  BS: 'Bosnisch',
  CS: 'Tschechisch',
  SK: 'Slowakisch',
  HU: 'Ungarisch',
  RO: 'Rumänisch',
  BG: 'Bulgarisch',
  EL: 'Griechisch',
  SQ: 'Albanisch',
  FA: 'Persisch',
  UR: 'Urdu',
  HI: 'Hindi',
  ZH: 'Chinesisch',
  JA: 'Japanisch',
  KO: 'Koreanisch',
  VI: 'Vietnamesisch',
  DA: 'Dänisch',
  SV: 'Schwedisch',
  FI: 'Finnisch',
};

const PROFILE_FIELD_LABELS = {
  fullName: 'Name',
  professionalTitle: 'Berufsbezeichnung',
  bio: 'Kurzbeschreibung',
  specializations: 'Spezialisierungen',
  languages: 'Sprachen',
};

const radiusOptions = [1, 3, 5, 10, 25];

const GENERIC_SEARCH_LABELS = ['physiotherapie', 'physio', 'therapeut', 'physiotherapeut', 'krankengymnastik'];

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const REG_STEPS = 5;
const languageOptions = Object.keys(LANGUAGE_MAP);

const getBaseUrl = () => BASE_URL;

const resolveMediaUrl = (value) => {
  if (!value || typeof value !== 'string') return value ?? null;
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  return value.startsWith('/') ? `${BASE_URL}${value}` : value;
};

// Required to bypass tunnel interstitial pages in dev
const TUNNEL_HEADERS = BASE_URL.includes('loca.lt')
  ? { 'bypass-tunnel-reminder': 'true' }
  : BASE_URL.includes('ngrok')
  ? { 'ngrok-skip-browser-warning': 'true' }
  : {};

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
  bookingMode: t.bookingMode ?? 'DIRECTORY_ONLY',
  requestable: t.requestable ?? false,
  nextFreeSlotAt: t.nextFreeSlotAt ?? null,
  requestability: t.requestability ?? null,
  fortbildungen: parseStringOrArray(t.certifications),
  distKm: typeof t.distKm === 'number' ? t.distKm : null,
  verifiziert: true,
  behandlungsbereiche: parseStringOrArray(t.specializations),
  verfügbareZeiten: '',
  website: '',
  photo: resolveMediaUrl(t.photo) ?? `https://i.pravatar.cc/96?u=${t.id}`,
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
    distKm: typeof p.distKm === 'number' ? p.distKm : null,
    logo: resolveMediaUrl(p.logo),
    photos: p.photos ?? [],
  })),
});

const normalizeTherapistProfile = (therapist) => {
  if (!therapist) return therapist;
  return {
    ...therapist,
    languages: normalizeLanguageCodes(therapist.languages),
    photo: resolveMediaUrl(therapist.photo),
    practices: Array.isArray(therapist.practices)
      ? therapist.practices.map((practice) => ({
          ...practice,
          logo: resolveMediaUrl(practice.logo),
          photos: Array.isArray(practice.photos)
            ? practice.photos.map(resolveMediaUrl)
            : practice.photos,
        }))
      : therapist.practices,
  };
};

const formatMissingProfileFields = (fields = []) =>
  fields.map((field) => PROFILE_FIELD_LABELS[field] ?? field);

const softenErrorMessage = (message = '') => {
  if (typeof message !== 'string') return '';
  return message
    .replace(/Fehler beim Laden/gi, 'Konnte nicht geladen werden – bitte erneut versuchen')
    .replace(/Ungültige E-Mail/gi, 'Bitte eine gültige E-Mail eingeben')
    .replace(/Etwas ist schiefgelaufen/gi, 'Hat nicht geklappt – bitte nochmal versuchen');
};

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

const GERMAN_CITIES = [
  'Aachen', 'Augsburg', 'Bamberg', 'Bayreuth', 'Berlin', 'Bielefeld', 'Bochum',
  'Bonn', 'Bottrop', 'Brandenburg an der Havel', 'Braunschweig', 'Bremen',
  'Bremerhaven', 'Chemnitz', 'Cottbus', 'Darmstadt', 'Dessau-Roßlau', 'Dortmund',
  'Dresden', 'Duisburg', 'Düsseldorf', 'Erfurt', 'Erlangen', 'Essen',
  'Flensburg', 'Frankfurt am Main', 'Frankfurt (Oder)', 'Freiburg im Breisgau',
  'Fürth', 'Gelsenkirchen', 'Gera', 'Göttingen', 'Greifswald', 'Gütersloh',
  'Hagen', 'Halle (Saale)', 'Hamburg', 'Hamm', 'Hannover', 'Heidelberg',
  'Heilbronn', 'Herne', 'Hildesheim', 'Ingolstadt', 'Iserlohn', 'Jena',
  'Kaiserslautern', 'Karlsruhe', 'Kassel', 'Kiel', 'Koblenz', 'Köln',
  'Krefeld', 'Landshut', 'Leipzig', 'Leverkusen', 'Lübeck', 'Ludwigshafen am Rhein',
  'Lüneburg', 'Magdeburg', 'Mainz', 'Mannheim', 'Moers', 'Mönchengladbach',
  'Mülheim an der Ruhr', 'München', 'Münster', 'Neuss', 'Neumünster',
  'Nürnberg', 'Oberhausen', 'Offenbach am Main', 'Oldenburg', 'Osnabrück',
  'Paderborn', 'Pforzheim', 'Potsdam', 'Ratingen', 'Recklinghausen',
  'Regensburg', 'Remscheid', 'Reutlingen', 'Rostock', 'Saarbrücken',
  'Salzgitter', 'Schwerin', 'Siegen', 'Solingen', 'Stuttgart', 'Trier',
  'Tübingen', 'Ulm', 'Velbert', 'Villingen-Schwenningen', 'Witten',
  'Wolfsburg', 'Wuppertal', 'Würzburg', 'Wiesbaden', 'Zwickau',
  'Aschaffenburg', 'Baden-Baden', 'Bergisch Gladbach', 'Bremerhaven',
  'Friedrichshafen', 'Göppingen', 'Heidenheim an der Brenz', 'Hersfeld',
  'Kaiserslautern', 'Konstanz', 'Kempten (Allgäu)', 'Lüdenscheid', 'Marburg',
  'Minden', 'Mülheim', 'Passau', 'Ravensburg', 'Rosenheim', 'Salzgitter',
  'Stralsund', 'Suhl', 'Troisdorf', 'Weimar', 'Wilhelmshaven',
];

export {
  COLORS,
  SPACE,
  RADIUS,
  SHADOW,
  TYPE,
  REG_STEPS,
  allSuggestions,
  fortbildungOptions,
  radiusOptions,
  formatDist,
  formatMissingProfileFields,
  getBaseUrl,
  TUNNEL_HEADERS,
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
  resolveMediaUrl,
  softenErrorMessage,
  tabs,
  GERMAN_CITIES,
};
