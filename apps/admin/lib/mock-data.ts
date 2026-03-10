export const summaryCards = [
  { label: 'Ausstehende Therapeut:innen', value: 4 },
  { label: 'Ausstehende Praxen', value: 2 },
  { label: 'Umstrittene Verknüpfungen', value: 1 },
  { label: 'Freigegebene Profile', value: 20 },
];

export const therapistRows = [
  {
    name: 'Julia Neumann',
    title: 'Physiotherapeutin',
    city: 'Köln',
    specializations: 'Manuelle Therapie, Sportrehabilitation',
    submitted: '2026-03-08',
    status: 'WARTET_AUF_PRÜFUNG',
  },
  {
    name: 'Levin Schuster',
    title: 'Physiotherapeut',
    city: 'Bonn',
    specializations: 'Pädiatrie',
    submitted: '2026-03-07',
    status: 'ÄNDERUNGEN_ANGEFORDERT',
  },
];

export const practiceRows = [
  {
    name: 'Rhein Physio Zentrum',
    city: 'Köln',
    linkedTherapists: 3,
    submitted: '2026-03-06',
    status: 'WARTET_AUF_PRÜFUNG',
  },
];

export const linkRows = [
  {
    therapist: 'Julia Neumann',
    practice: 'Rhein Physio Zentrum',
    status: 'VORGESCHLAGEN',
    submitted: '2026-03-08',
  },
  {
    therapist: 'Levin Schuster',
    practice: 'Praxis Nord',
    status: 'UMSTRITTEN',
    submitted: '2026-03-04',
  },
];
