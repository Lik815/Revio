import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_CITY = 'Köln';
const TARGET_COUNT = 20;

const DISTRICTS = [
  { label: 'Altstadt-Nord', lat: 50.9418, lng: 6.9582 },
  { label: 'Altstadt-Sued', lat: 50.9249, lng: 6.9648 },
  { label: 'Deutz', lat: 50.9373, lng: 6.9785 },
  { label: 'Ehrenfeld', lat: 50.9498, lng: 6.9191 },
  { label: 'Nippes', lat: 50.9674, lng: 6.9514 },
  { label: 'Suelz', lat: 50.9178, lng: 6.9234 },
  { label: 'Lindenthal', lat: 50.9278, lng: 6.9063 },
  { label: 'Muelheim', lat: 50.9622, lng: 7.0048 },
  { label: 'Kalk', lat: 50.9387, lng: 7.0109 },
  { label: 'Rodenkirchen', lat: 50.8895, lng: 6.9976 },
  { label: 'Braunsfeld', lat: 50.9404, lng: 6.8973 },
  { label: 'Junkersdorf', lat: 50.9344, lng: 6.8574 },
  { label: 'Bayenthal', lat: 50.9058, lng: 6.9699 },
  { label: 'Zollstock', lat: 50.9068, lng: 6.9342 },
  { label: 'Dellbrueck', lat: 50.9776, lng: 7.0607 },
  { label: 'Longerich', lat: 50.9916, lng: 6.9285 },
  { label: 'Niehl', lat: 50.9770, lng: 6.9649 },
  { label: 'Weiden', lat: 50.9428, lng: 6.8357 },
  { label: 'Porz', lat: 50.8840, lng: 7.0473 },
  { label: 'Chorweiler', lat: 51.0201, lng: 6.8983 },
];

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
  'Krueger',
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
  'Rueckenschmerzen',
  'Schulterrehabilitation',
  'Postoperative Reha',
  'Orthopaedische Rehabilitation',
  'Beckenbodentherapie',
  'Atemtherapie',
];

const CERTIFICATIONS = ['MT', 'KGG', 'Bobath', 'PNF', 'OMT', 'Kinesiotaping'];
const LANGUAGES = ['en', 'tr', 'ar', 'fr', 'es', 'it', 'pl'];
const KASSENART_OPTIONS = ['privat', 'selbstzahler'];
const SERVICE_RADII = [5, 8, 10, 12, 15, 20];
const AVAILABILITY_OPTIONS = [
  'Mo-Fr 8:00-18:00 Uhr',
  'Mo-Fr 9:00-18:00 Uhr',
  'Mo-Do 8:00-18:00, Fr 8:00-15:00 Uhr',
  'Di-Sa 9:00-18:00 Uhr',
  'Mo, Mi, Fr 8:00-17:00 Uhr',
  'Kurzfristige Hausbesuche unter der Woche moeglich',
];

const BIOS = [
  'Freiberufliche Physiotherapie mit Fokus auf ruhige, strukturierte Behandlungen und klare Uebungen fuer zuhause.',
  'Ich begleite Patientinnen und Patienten im Raum Koeln mit alltagsnaher Therapie und verlaesslicher Kommunikation.',
  'Mein Schwerpunkt liegt auf mobiler Physiotherapie, damit Behandlung auch bei eingeschraenkter Mobilitaet gut moeglich bleibt.',
  'Ich arbeite evidenzbasiert und verbinde manuelle Techniken mit funktionellem Training im Alltag.',
  'Im Mittelpunkt meiner Arbeit stehen individuelle Ziele, ein klarer Therapieplan und flexible Hausbesuche.',
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
  const importedTherapists: Array<{ id: string; fullName: string; email: string }> = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < TARGET_COUNT; i++) {
    const district = DISTRICTS[i];
    const { isFemale, fullName } = therapistName(i);
    const email = `koeln.freelance.${String(i + 1).padStart(3, '0')}@demo.revio.de`;
    const specializations = pickN(SPECIALIZATIONS, 2 + (i % 2), i * 7);
    const certifications = pickN(CERTIFICATIONS, 1 + (i % 2), i * 5);
    const extraLanguages = pickN(LANGUAGES, i % 3, i * 2);
    const serviceRadiusKm = pick(SERVICE_RADII, i);
    const availability = pick(AVAILABILITY_OPTIONS, i);
    const kassenart = pick(KASSENART_OPTIONS, i);
    const photo = `https://randomuser.me/api/portraits/${isFemale ? 'women' : 'men'}/${(i % 90) + 1}.jpg`;
    const bio = `${pick(BIOS, i)} Einsatzschwerpunkt in ${district.label}, ${TARGET_CITY}.`;
    const nextFreeSlotAt = new Date();
    nextFreeSlotAt.setDate(nextFreeSlotAt.getDate() + 1 + (i % 6));
    nextFreeSlotAt.setHours(8 + (i % 5), i % 2 === 0 ? 0 : 30, 0, 0);

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
        bio,
        homeVisit: true,
        specializations: specializations.join(', '),
        languages: ['de', ...extraLanguages].join(', '),
        certifications: certifications.join(', '),
        kassenart,
        availability,
        serviceRadiusKm,
        homeLat: district.lat,
        homeLng: district.lng,
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        invitedByPracticeId: null,
        onboardingStatus: 'none',
        visibilityPreference: 'visible',
        photo,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        nextFreeSlotAt,
      },
      create: {
        email,
        fullName,
        professionalTitle: isFemale ? 'Physiotherapeutin' : 'Physiotherapeut',
        city: TARGET_CITY,
        bio,
        homeVisit: true,
        specializations: specializations.join(', '),
        languages: ['de', ...extraLanguages].join(', '),
        certifications: certifications.join(', '),
        kassenart,
        availability,
        serviceRadiusKm,
        homeLat: district.lat,
        homeLng: district.lng,
        reviewStatus: 'APPROVED',
        isVisible: true,
        isPublished: true,
        invitedByPracticeId: null,
        onboardingStatus: 'none',
        visibilityPreference: 'visible',
        photo,
        bookingMode: 'FIRST_APPOINTMENT_REQUEST',
        nextFreeSlotAt,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    await prisma.therapistPracticeLink.deleteMany({
      where: { therapistId: therapist.id },
    });

    importedTherapists.push(therapist);
    if (existing) updatedCount++;
    else createdCount++;
  }

  const db = prisma as any;
  await db.searchSuggestion.deleteMany({
    where: {
      type: 'THERAPIST_NAME',
      entityId: { in: importedTherapists.map((therapist) => therapist.id) },
    },
  });

  await db.searchSuggestion.createMany({
    data: importedTherapists.map((therapist) => ({
      text: therapist.fullName,
      normalized: normalizeText(therapist.fullName),
      type: 'THERAPIST_NAME',
      entityId: therapist.id,
      weight: 5,
    })),
  });

  const totalFreelancers = await prisma.therapist.count({
    where: {
      city: TARGET_CITY,
      email: { endsWith: '@demo.revio.de' },
      bookingMode: 'FIRST_APPOINTMENT_REQUEST',
      homeVisit: true,
      serviceRadiusKm: { not: null },
      isVisible: true,
      reviewStatus: 'APPROVED',
      links: { none: {} },
    },
  });

  console.log(
    `Added freelance therapists in ${TARGET_CITY}: created=${createdCount}, updated=${updatedCount}, totalStandaloneVisible=${totalFreelancers}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
