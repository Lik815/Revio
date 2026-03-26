import { PrismaClient } from '@prisma/client';
import { ensurePracticeLogoAsset } from './practice-logo.js';

const prisma = new PrismaClient();

const TARGET_CITY = 'Köln';
const TARGET_COUNT = 200;

const FEMALE_FIRST_NAMES = [
  'Anna',
  'Julia',
  'Laura',
  'Sarah',
  'Marie',
  'Lea',
  'Katharina',
  'Franziska',
  'Sophie',
  'Nina',
];

const MALE_FIRST_NAMES = [
  'Max',
  'Jonas',
  'Lukas',
  'Paul',
  'Tim',
  'Leon',
  'Daniel',
  'Stefan',
  'Tobias',
  'Felix',
];

const LAST_NAMES = [
  'Becker',
  'Schneider',
  'Hoffmann',
  'Kaya',
  'Wolf',
  'Yilmaz',
  'Krüger',
  'Demir',
  'Wagner',
  'Peters',
];

const SPECIALIZATIONS = [
  'Manuelle Therapie',
  'Sportphysiotherapie',
  'Lymphdrainage',
  'Neurologische Rehabilitation',
  'Krankengymnastik',
  'Bobath-Therapie',
  'Rückenschmerzen',
  'Schulterrehabilitation',
  'Postoperative Reha',
  'Orthopädische Rehabilitation',
  'Beckenbodentherapie',
  'Atemtherapie',
];

const CERTIFICATIONS = ['MT', 'KGG', 'Bobath', 'PNF', 'OMT', 'Kinesiotaping'];

const LANGUAGES = ['en', 'tr', 'ar', 'fr', 'es', 'it', 'pl'];

const AVAILABILITY_OPTIONS = [
  'Mo–Fr 8:00–18:00 Uhr',
  'Mo–Fr 7:30–19:00 Uhr',
  'Mo–Do 8:00–18:00, Fr 8:00–16:00 Uhr',
  'Mo–Fr 9:00–18:00 Uhr',
  'Mo–Fr 8:30–18:30 Uhr',
  'Di–Sa 9:00–18:00 Uhr',
];

const KASSENART_OPTIONS = ['gesetzlich', 'privat', 'selbstzahler'];

const BIOS = [
  'Ich begleite Patientinnen und Patienten mit einem klar strukturierten Therapieplan und viel Zeit fuer die Befunderhebung.',
  'Mein Schwerpunkt liegt auf alltagsnaher Rehabilitation, damit Beweglichkeit und Belastbarkeit nachhaltig zurueckkehren.',
  'Ich arbeite evidenzbasiert und kombiniere klassische Physiotherapie mit funktionellem Training.',
  'Mir ist wichtig, Beschwerden ganzheitlich zu betrachten und die Therapie gut in den Alltag zu integrieren.',
  'Ich behandle orthopaedische und neurologische Beschwerden mit einem ruhigen, praezisen und patientenzentrierten Ansatz.',
  'Im Mittelpunkt meiner Arbeit stehen individuelle Ziele, transparente Aufklaerung und eine klare Uebungsstrategie fuer zuhause.',
];

const PRACTICE_NAMES = [
  'Physioatelier',
  'Bewegungswerk',
  'Therapiepunkt',
  'RehaWerk',
  'Vitalraum',
  'Koerperwerk',
  'Physio Studio',
  'Mobilitaetszentrum',
  'Praxis fuer Physio',
  'Therapiehaus',
  'Bewegungslabor',
  'Gelenkpunkt',
  'Therapieforum',
  'PhysioBalance',
  'Aktivraum',
  'Reha & Mobilitaet',
  'Koeln Physio',
  'Bewegungsatelier',
  'Therapie am Park',
  'Motion Lab',
];

const PRACTICE_DISTRICTS = [
  { label: 'Altstadt-Nord', street: 'Komoedienstrasse', houseNumber: 12, postal: '50667', lat: 50.9418, lng: 6.9582 },
  { label: 'Altstadt-Sued', street: 'Severinstrasse', houseNumber: 48, postal: '50678', lat: 50.9249, lng: 6.9648 },
  { label: 'Deutz', street: 'Siegburger Strasse', houseNumber: 27, postal: '50679', lat: 50.9373, lng: 6.9785 },
  { label: 'Ehrenfeld', street: 'Venloer Strasse', houseNumber: 216, postal: '50823', lat: 50.9498, lng: 6.9191 },
  { label: 'Nippes', street: 'Neusser Strasse', houseNumber: 311, postal: '50733', lat: 50.9674, lng: 6.9514 },
  { label: 'Suelz', street: 'Berrenrather Strasse', houseNumber: 185, postal: '50937', lat: 50.9178, lng: 6.9234 },
  { label: 'Lindenthal', street: 'Duerenstrasse', houseNumber: 92, postal: '50931', lat: 50.9278, lng: 6.9063 },
  { label: 'Muelheim', street: 'Frankfurter Strasse', houseNumber: 110, postal: '51065', lat: 50.9622, lng: 7.0048 },
  { label: 'Kalk', street: 'Kalker Hauptstrasse', houseNumber: 132, postal: '51103', lat: 50.9387, lng: 7.0109 },
  { label: 'Rodenkirchen', street: 'Hauptstrasse', houseNumber: 71, postal: '50996', lat: 50.8895, lng: 6.9976 },
  { label: 'Braunsfeld', street: 'Aachener Strasse', houseNumber: 563, postal: '50933', lat: 50.9404, lng: 6.8973 },
  { label: 'Junkersdorf', street: 'Aachener Strasse', houseNumber: 1120, postal: '50858', lat: 50.9344, lng: 6.8574 },
  { label: 'Bayenthal', street: 'Bonner Strasse', houseNumber: 188, postal: '50968', lat: 50.9058, lng: 6.9699 },
  { label: 'Zollstock', street: 'Hoeniger Weg', houseNumber: 44, postal: '50969', lat: 50.9068, lng: 6.9342 },
  { label: 'Dellbrueck', street: 'Dellbruecker Hauptstrasse', houseNumber: 85, postal: '51069', lat: 50.9776, lng: 7.0607 },
  { label: 'Longerich', street: 'Grethenstrasse', houseNumber: 10, postal: '50739', lat: 50.9916, lng: 6.9285 },
  { label: 'Niehl', street: 'Sebastianstrasse', houseNumber: 156, postal: '50735', lat: 50.977, lng: 6.9649 },
  { label: 'Weiden', street: 'Aachener Strasse', houseNumber: 1253, postal: '50858', lat: 50.9428, lng: 6.8357 },
  { label: 'Porz', street: 'Josefstrasse', houseNumber: 28, postal: '51143', lat: 50.884, lng: 7.0473 },
  { label: 'Chorweiler', street: 'Pariser Platz', houseNumber: 4, postal: '50765', lat: 51.0201, lng: 6.8983 },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function pickN<T>(items: T[], count: number, seed: number): T[] {
  const selected: T[] = [];

  for (let i = 0; i < count; i++) {
    selected.push(items[(seed + i * 3) % items.length]);
  }

  return [...new Set(selected)];
}

async function ensurePractice(index: number) {
  const district = PRACTICE_DISTRICTS[index];
  const name = `${PRACTICE_NAMES[index]} ${district.label}`;
  const address = `${district.street} ${district.houseNumber}, ${district.postal} ${TARGET_CITY}`;
  const phone = `+49 221 ${700000 + index * 37}`;
  const hours = pick(AVAILABILITY_OPTIONS, index);
  const description = `Physiotherapie in ${district.label} mit Fokus auf moderne Rehabilitation, alltagsnahe Bewegungstherapie und persoenliche Betreuung.`;
  const photos = JSON.stringify([
    `https://picsum.photos/id/${310 + index}/900/600`,
    `https://picsum.photos/id/${410 + index}/900/600`,
  ]);
  const logo = ensurePracticeLogoAsset(name, TARGET_CITY);

  const existing = await prisma.practice.findFirst({
    where: {
      name,
      address,
    },
  });

  if (existing) {
    return {
      created: false,
      practice: await prisma.practice.update({
        where: { id: existing.id },
        data: {
          city: TARGET_CITY,
          phone,
          hours,
          lat: district.lat,
          lng: district.lng,
          description,
          reviewStatus: 'APPROVED',
          homeVisit: index % 3 === 0,
          logo,
          photos,
        },
      }),
    };
  }

  return {
    created: true,
    practice: await prisma.practice.create({
      data: {
        name,
        city: TARGET_CITY,
        address,
        phone,
        hours,
        lat: district.lat,
        lng: district.lng,
        description,
        reviewStatus: 'APPROVED',
        homeVisit: index % 3 === 0,
        logo,
        photos,
      },
    }),
  };
}

function therapistName(index: number) {
  const isFemale = index % 2 === 0;
  const pairIndex = Math.floor(index / 2);
  const firstNames = isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const firstName = firstNames[pairIndex % firstNames.length];
  const lastName = LAST_NAMES[Math.floor(pairIndex / firstNames.length)];

  return {
    isFemale,
    fullName: `${firstName} ${lastName}`,
  };
}

async function main() {
  const practiceRecords: { id: string; name: string }[] = [];
  let createdPracticeCount = 0;

  for (let i = 0; i < PRACTICE_DISTRICTS.length; i++) {
    const { created, practice } = await ensurePractice(i);
    if (created) createdPracticeCount++;
    practiceRecords.push({ id: practice.id, name: practice.name });
  }

  let createdTherapistCount = 0;
  let updatedTherapistCount = 0;
  const importedTherapists: Array<{ id: string; fullName: string }> = [];

  for (let i = 0; i < TARGET_COUNT; i++) {
    const { isFemale, fullName } = therapistName(i);
    const email = `koeln.therapeut.${String(i + 1).padStart(3, '0')}@demo.revio.de`;
    const practice = practiceRecords[i % practiceRecords.length];
    const extraLanguages = pickN(LANGUAGES, i % 3, i);
    const certifications = pickN(CERTIFICATIONS, i % 3, i * 5);
    const specializations = pickN(SPECIALIZATIONS, 2 + (i % 2), i * 7);
    const therapistBio = `${pick(BIOS, i)} Schwerpunkt in ${practice.name} und im Raum ${TARGET_CITY}.`;
    const portraitIndex = (Math.floor(i / 2) % 90) + 1;
    const photo = `https://randomuser.me/api/portraits/${isFemale ? 'women' : 'men'}/${portraitIndex}.jpg`;

    const existing = await prisma.therapist.findUnique({
      where: { email },
      select: { id: true },
    });

    const therapist = await prisma.therapist.upsert({
      where: { email },
      update: {
        fullName,
        professionalTitle: isFemale ? 'Physiotherapeutin' : 'Physiotherapeut',
        city: TARGET_CITY,
        bio: therapistBio,
        homeVisit: i % 4 !== 0,
        specializations: specializations.join(', '),
        languages: ['de', ...extraLanguages].join(', '),
        certifications: certifications.join(', '),
        kassenart: pick(KASSENART_OPTIONS, i),
        availability: pick(AVAILABILITY_OPTIONS, i * 3),
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        invitedByPracticeId: null,
        onboardingStatus: 'none',
        photo,
      },
      create: {
        email,
        fullName,
        professionalTitle: isFemale ? 'Physiotherapeutin' : 'Physiotherapeut',
        city: TARGET_CITY,
        bio: therapistBio,
        homeVisit: i % 4 !== 0,
        specializations: specializations.join(', '),
        languages: ['de', ...extraLanguages].join(', '),
        certifications: certifications.join(', '),
        kassenart: pick(KASSENART_OPTIONS, i),
        availability: pick(AVAILABILITY_OPTIONS, i * 3),
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        invitedByPracticeId: null,
        onboardingStatus: 'none',
        photo,
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (existing) updatedTherapistCount++;
    else createdTherapistCount++;

    await prisma.therapistPracticeLink.upsert({
      where: {
        therapistId_practiceId: {
          therapistId: therapist.id,
          practiceId: practice.id,
        },
      },
      update: {
        status: 'CONFIRMED',
        initiatedBy: 'ADMIN',
      },
      create: {
        therapistId: therapist.id,
        practiceId: practice.id,
        status: 'CONFIRMED',
        initiatedBy: 'ADMIN',
      },
    });

    importedTherapists.push(therapist);
  }

  const db = prisma as any;
  const therapistIds = importedTherapists.map((therapist) => therapist.id);
  const practiceIds = practiceRecords.map((practice) => practice.id);

  const [existingTherapistSuggestions, existingPracticeSuggestions, citySuggestion] = await Promise.all([
    db.searchSuggestion.findMany({
      where: {
        type: 'THERAPIST_NAME',
        entityId: { in: therapistIds },
      },
      select: { entityId: true },
    }),
    db.searchSuggestion.findMany({
      where: {
        type: 'PRACTICE_NAME',
        entityId: { in: practiceIds },
      },
      select: { entityId: true },
    }),
    db.searchSuggestion.findFirst({
      where: {
        type: 'CITY',
        normalized: normalizeText(TARGET_CITY),
      },
      select: { id: true },
    }),
  ]);

  const therapistSuggestionIds = new Set(
    existingTherapistSuggestions
      .map((row: { entityId: string | null }) => row.entityId)
      .filter(Boolean),
  );

  const practiceSuggestionIds = new Set(
    existingPracticeSuggestions
      .map((row: { entityId: string | null }) => row.entityId)
      .filter(Boolean),
  );

  const suggestionRows = [
    ...importedTherapists
      .filter((therapist) => !therapistSuggestionIds.has(therapist.id))
      .map((therapist) => ({
        text: therapist.fullName,
        normalized: normalizeText(therapist.fullName),
        type: 'THERAPIST_NAME',
        entityId: therapist.id,
        weight: 5,
      })),
    ...practiceRecords
      .filter((practice) => !practiceSuggestionIds.has(practice.id))
      .map((practice) => ({
        text: practice.name,
        normalized: normalizeText(practice.name),
        type: 'PRACTICE_NAME',
        entityId: practice.id,
        weight: 4,
      })),
  ];

  if (!citySuggestion) {
    suggestionRows.push({
      text: TARGET_CITY,
      normalized: normalizeText(TARGET_CITY),
      type: 'CITY',
      entityId: null,
      weight: 3,
    });
  }

  if (suggestionRows.length > 0) {
    await db.searchSuggestion.createMany({ data: suggestionRows });
  }

  const totalTherapistsInCologne = await prisma.therapist.count({
    where: { city: TARGET_CITY },
  });

  const approvedTherapistsInCologne = await prisma.therapist.count({
    where: {
      city: TARGET_CITY,
      reviewStatus: 'APPROVED',
    },
  });

  console.log('Koeln import complete.');
  console.log(`  Practices created now: ${createdPracticeCount}`);
  console.log(`  Therapists created now: ${createdTherapistCount}`);
  console.log(`  Therapists updated now: ${updatedTherapistCount}`);
  console.log(`  Suggestions inserted now: ${suggestionRows.length}`);
  console.log(`  Total therapists in ${TARGET_CITY}: ${totalTherapistsInCologne}`);
  console.log(`  Approved therapists in ${TARGET_CITY}: ${approvedTherapistsInCologne}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
