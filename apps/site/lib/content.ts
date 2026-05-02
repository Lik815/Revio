export const siteConfig = {
  title: 'Revio',
  contactEmail: 'admin@my-revio.de',
  nav: [
    { href: '/', label: 'Startseite' },
    { href: '/patients', label: 'Für Patient:innen' },
    { href: '/therapists', label: 'Für Therapeut:innen' },
    { href: '/blog', label: 'Blog' },
    { href: '/about', label: 'Über Revio' },
    { href: '/contact', label: 'Kontakt' },
  ],
  footerNav: [
    { href: '/impressum', label: 'Impressum' },
    { href: '/datenschutz', label: 'Datenschutz' },
  ],
};

export const homeHighlights = [
  {
    title: 'Passende Spezialisierungen schneller finden',
    body: 'Revio hilft dabei, Physiotherapeut:innen klarer nach Fachgebiet, Schwerpunkt und Beschwerdebild zu entdecken.',
  },
  {
    title: 'In der Nähe oder mobil suchen',
    body: 'Standort, Hausbesuch und Einsatzgebiet werden verständlich dargestellt, ohne die Suche unnötig aufzublähen.',
  },
  {
    title: 'Direkt Kontakt aufnehmen',
    body: 'Das MVP konzentriert sich auf den entscheidenden Schritt: die passende Physiotherapie finden und unkompliziert erreichen.',
  },
];

export const patientBenefits = [
  {
    title: 'Passende Physiotherapeut:innen nach Fachgebiet entdecken',
    body: 'Filtere nach Spezialisierung wie Sportphysio, Neurologie oder manuelle Therapie — und finde direkt den richtigen Fachbereich für dein Beschwerdebild.',
  },
  {
    title: 'Therapeut:innen in der Nähe oder für mobile Behandlungen finden',
    body: 'Suche nach Standort oder aktiviere die Option für Hausbesuche — Revio zeigt dir transparent, wer in deiner Nähe behandelt und wer zu dir kommt.',
  },
  {
    title: 'Profile klarer vergleichen und besser einordnen',
    body: 'Qualifikationen, Sprachen, Schwerpunkte und Einsatzgebiet auf einen Blick — ohne dass du zwischen zehn Tabs wechseln musst.',
  },
  {
    title: 'Direkt Kontakt aufnehmen, ohne sich durch komplizierte Terminlogik zu kämpfen',
    body: 'Kein Buchungssystem das überfordert. Im MVP steht ein klarer, direkter Kontaktweg im Vordergrund.',
  },
];

export const therapistBenefits = [
  {
    title: 'Mit einem professionellen Profil sichtbar werden',
    body: 'Dein Revio-Profil zeigt Fachgebiete, Qualifikationen und Schwerpunkte klar strukturiert — damit Patient:innen dich fachlich einordnen können.',
  },
  {
    title: 'Von passenden Patient:innen besser gefunden werden',
    body: 'Revio bringt dich nicht in eine endlose Liste, sondern matcht dich mit Menschen, deren Beschwerdebild zu deiner Expertise passt.',
  },
  {
    title: 'Einen klaren digitalen Auftritt aufbauen',
    body: 'Kein Marketplace-Eintrag, kein unruhiges Bewertungsportal. Revio gibt dir einen ruhigen, medizinisch glaubwürdigen digitalen Auftritt.',
  },
  {
    title: 'In einem hochwertigen Produktumfeld auftreten',
    body: 'Revio positioniert sich bewusst nicht als lautstarke Plattform — sondern als Ort, an dem Expertise sichtbar wird ohne Lärm.',
  },
];

export const profileIncludes = [
  'Fachgebiete und Schwerpunkte',
  'Sprachen und Qualifikationen',
  'Standort und Einsatzgebiet',
  'Hausbesuch, falls angeboten',
  'Praxisbezug oder eigenständiges Profil',
];

export const principles = [
  'Klarheit statt Überforderung',
  'Qualität statt Lautstärke',
  'Vertrauen statt Marktplatzgefühl',
  'Ein digitales Produkt, das medizinisch ernst genommen werden kann',
];

export const showcaseScreens = [
  {
    src: '/screenshot-1.png',
    alt: 'Revio Suche mit passenden Physiotherapeut:innen in der App',
    title: 'Suche mit klarem Fokus',
    body: 'Beschwerden, Ort und mobile Behandlung werden ruhig und verständlich zusammengeführt.',
    tone: 'left' as const,
  },
  {
    src: '/screenshot-2.png',
    alt: 'Revio Favoritenansicht mit gespeicherten Therapeut:innen',
    title: 'Favoriten mit Gedächtnis',
    body: 'Gefundene Therapeut:innen bleiben schnell wieder auffindbar, ohne dass die App unnötig kompliziert wird.',
    tone: 'center' as const,
  },
  {
    src: '/screenshot-3.png',
    alt: 'Revio Optionen und ruhige Kontoansicht in der App',
    title: 'Fokussierte Produktoberfläche',
    body: 'Die App bleibt bewusst reduziert und wirkt eher wie ein hochwertiges Gesundheitsprodukt als wie ein Marktplatz.',
    tone: 'right' as const,
  },
];
