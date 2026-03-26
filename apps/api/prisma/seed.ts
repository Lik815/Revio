import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { ensurePracticeLogoAsset } from './practice-logo.js';

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

// Inline normalization (avoids ESM import issues in seed context)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

type SuggestionRow = {
  text: string;
  normalized: string;
  type: 'THERAPIST_NAME' | 'PRACTICE_NAME' | 'SPECIALTY' | 'CITY';
  entityId?: string;
  weight: number;
};

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

// ── Stammdaten ───────────────────────────────────────────────────────────────

const CITIES: Record<string, { lat: number; lng: number }> = {
  'Köln':       { lat: 50.9333, lng: 6.9500 },
  'München':    { lat: 48.1351, lng: 11.5820 },
  'Berlin':     { lat: 52.5200, lng: 13.4050 },
  'Hamburg':    { lat: 53.5753, lng: 10.0153 },
  'Frankfurt':  { lat: 50.1109, lng: 8.6821 },
  'Stuttgart':  { lat: 48.7758, lng: 9.1829 },
  'Düsseldorf': { lat: 51.2217, lng: 6.7762 },
  'Leipzig':    { lat: 51.3397, lng: 12.3731 },
  'Bonn':       { lat: 50.7374, lng: 7.0982 },
  'Dortmund':   { lat: 51.5136, lng: 7.4653 },
};
const CITY_NAMES = Object.keys(CITIES);

const FIRST_NAMES_F = ['Anna', 'Julia', 'Laura', 'Sarah', 'Marie', 'Lisa', 'Katharina', 'Sandra', 'Nicole', 'Petra',
  'Claudia', 'Sabine', 'Monika', 'Christina', 'Stefanie', 'Anja', 'Franziska', 'Melanie', 'Nadine', 'Jasmin'];
const FIRST_NAMES_M = ['Max', 'Felix', 'Jonas', 'Lukas', 'Paul', 'Tim', 'Julian', 'Markus', 'Stefan', 'Thomas',
  'Andreas', 'Michael', 'Sebastian', 'Christian', 'Daniel', 'Patrick', 'Simon', 'Tobias', 'Florian', 'Benjamin'];
const LAST_NAMES = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz',
  'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann',
  'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Krause', 'Meier', 'Lehmann'];

const ALL_SPECS = [
  'Rückenschmerzen', 'Sportphysiotherapie', 'Manualtherapie', 'Neurologische Rehabilitation',
  'Bobath-Therapie', 'Osteopathie', 'Lymphdrainage', 'Krankengymnastik', 'Atemtherapie',
  'Kinesiotaping', 'Triggerpunkt-Therapie', 'Dry Needling', 'Vojta-Therapie',
  'Geriatrische Rehabilitation', 'Pädiatrische Physiotherapie', 'Orthopädische Rehabilitation',
  'Wirbelsäulentherapie', 'Schulterrehabilitation', 'Kniereha', 'Hüftreha',
  'Fußtherapie', 'Handtherapie', 'Nackenschmerzen', 'Beckenbodentherapie',
  'Postoperative Reha', 'Aquatherapie', 'Entspannungstherapie',
];

const ALL_CERTS = ['MT', 'KGG', 'Bobath', 'Vojta', 'MDT', 'PNF', 'DNS', 'FDM', 'OMT', 'Kinesiotaping'];

const KASSENART_OPTIONS = ['gesetzlich', 'privat', 'selbstzahler'];

const AVAILABILITY_OPTIONS = [
  'Mo–Fr 8:00–18:00 Uhr',
  'Mo–Fr 7:30–19:00 Uhr',
  'Mo–Fr 8:00–17:00, Sa 9:00–13:00 Uhr',
  'Mo–Do 8:00–18:00, Fr 8:00–17:00 Uhr',
  'Mo–Fr 9:00–18:00 Uhr',
  'Mo–Mi 8:00–18:00, Do–Fr 8:00–16:00 Uhr',
  'Di–Sa 9:00–18:00 Uhr',
  'Mo–Fr 8:30–18:30 Uhr',
  '',
  '',
];

const ALL_LANGS = ['de', 'en', 'tr', 'ru', 'ar', 'fr', 'it', 'es', 'pl', 'hr'];

const BIOS = [
  'Ich behandle mit einem ganzheitlichen Ansatz und lege großen Wert auf individuelle Therapiepläne.',
  'Mein Schwerpunkt liegt auf der Behandlung von Sportverletzungen und der Rückkehr zur vollen Leistungsfähigkeit.',
  'Mit über 10 Jahren Erfahrung biete ich fundierte Therapie für alle Altersgruppen.',
  'Ich kombiniere klassische Physiotherapie mit modernen Behandlungsmethoden.',
  'Patienten stehen bei mir im Mittelpunkt – ich nehme mir Zeit für eine gründliche Befunderhebung.',
  'Spezialisiert auf chronische Schmerzpatienten und langfristige Rehabilitation.',
  'Ich arbeite eng mit Ärzten und Orthopäden zusammen für optimale Behandlungsergebnisse.',
  'Als zertifizierter Manualtherapeut behandle ich Gelenk- und Wirbelsäulenprobleme gezielt.',
  'Meine Leidenschaft gilt der neurologischen Rehabilitation und der Verbesserung der Lebensqualität.',
  'Ich biete Hausbesuche an und komme auch zu Patienten mit eingeschränkter Mobilität.',
  'Langjährige Erfahrung in der postoperativen Rehabilitation nach Knie- und Hüfteingriffen.',
  'Ich setze auf evidenzbasierte Methoden und kontinuierliche Fortbildung.',
];

const PRACTICE_NAMES = [
  'Physio & Motion', 'Bewegungswerk', 'PhysioBalance', 'Vita Physio', 'Therapiezentrum Am Markt',
  'PhysioKlinik', 'Reha & Sport', 'Physio Plus', 'Bewegungsraum', 'KörperKraft Physio',
  'PhysioAktiv', 'Zentrum für Physiotherapie', 'Praxis am Park', 'Praxis am See',
  'Praxis am Stadtrand', 'Gesundheitszentrum Nord', 'Gesundheitszentrum Süd',
  'Sportphysio Zentrum', 'Neuro Reha Zentrum', 'PhysioMed',
  'Therapiehaus', 'BewegungsArt', 'PhysioWerk', 'RehaFit', 'PhysioPoint',
  'Körperwerkstatt', 'Bewegungstherapie am Fluss', 'PhysioLife', 'Reha Balance', 'PhysioHome',
];

const STREETS = ['Hauptstraße', 'Bahnhofstraße', 'Kirchstraße', 'Gartenstraße', 'Schulstraße',
  'Bergstraße', 'Dorfstraße', 'Ringstraße', 'Waldstraße', 'Parkstraße',
  'Lindenstraße', 'Rosenstraße', 'Mozartstraße', 'Bismarckstraße', 'Goethestraße'];

const WORKING_HOURS = [
  'Mo–Fr 8:00–18:00',
  'Mo–Fr 7:30–19:00',
  'Mo–Fr 8:00–17:00, Sa 9:00–13:00',
  'Mo–Do 8:00–18:00, Fr 8:00–17:00',
  'Mo–Fr 9:00–18:00',
  'Mo–Fr 7:00–16:00',
  'Mo–Fr 8:30–18:30',
  'Mo–Fr 8:00–20:00',
  'Mo–Fr 9:00–19:00, Sa 9:00–12:00',
  'Mo–Do 7:30–18:00, Fr 7:30–16:00',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < n; i++) result.push(arr[(seed + i * 7) % arr.length]);
  return [...new Set(result)];
}

function jitter(base: number, seed: number, range = 0.06): number {
  return base + ((seed % 100) / 100 - 0.5) * range;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await prisma.practiceManager.deleteMany();
  await prisma.user.deleteMany();
  await prisma.therapistPracticeLink.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.practice.deleteMany();

  // ── 30 Praxen ─────────────────────────────────────────────────────────────
  const practiceRecords: { id: string; city: string }[] = [];

  for (let i = 0; i < 30; i++) {
    const cityName = CITY_NAMES[i % CITY_NAMES.length];
    const { lat, lng } = CITIES[cityName];
    const street = pick(STREETS, i * 3);
    const num = (i * 7 + 3) % 120 + 1;
    const postal = 10000 + (i * 137) % 900;

    // Generate practice admin credentials
    // First practice (Physio & Motion) gets the test therapist as admin
    const practiceSlug = PRACTICE_NAMES[i].toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/&/g, 'und').replace(/[^a-z0-9-]/g, '');
    const adminEmail = i === 0 ? 'test@revio.de' : `admin@${practiceSlug}.de`;
    const adminPwHash = await hashPassword(i === 0 ? 'password' : 'praxis123');

    // Deterministic picsum photo IDs (offset to get clinic/interior-ish images)
    const photoId1 = 200 + (i * 17) % 800;
    const photoId2 = 201 + (i * 23) % 800;
    const logo = ensurePracticeLogoAsset(PRACTICE_NAMES[i], cityName);

    const p = await prisma.practice.create({
      data: {
        name: PRACTICE_NAMES[i],
        city: cityName,
        address: `${street} ${num}, ${postal} ${cityName}`,
        phone: `+49 ${200 + i} ${1000000 + i * 13337}`,
        hours: pick(WORKING_HOURS, i * 5),
        lat: jitter(lat, i * 17),
        lng: jitter(lng, i * 31),
        reviewStatus: 'APPROVED',
        logo,
        photos: JSON.stringify([
          `https://picsum.photos/id/${photoId1}/600/400`,
          `https://picsum.photos/id/${photoId2}/600/400`,
        ]),
      },
    });

    // Create matching manager user + PracticeManager for this practice
    const managerUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminPwHash,
        role: 'manager',
      },
      create: {
        email: adminEmail,
        passwordHash: adminPwHash,
        role: 'manager',
      },
    });

    await prisma.practiceManager.create({
      data: {
        email: adminEmail,
        userId: managerUser.id,
        passwordHash: adminPwHash,
        practiceId: p.id,
      },
    });

    practiceRecords.push({ id: p.id, city: cityName });
  }

  // ── 100 Therapeuten ───────────────────────────────────────────────────────
  for (let i = 0; i < 100; i++) {
    const isFemale = i % 2 === 0;
    const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M, i);
    const lastName = pick(LAST_NAMES, i * 3 + 1);
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')}.${i}@example.com`;

    const numSpecs = (i % 3) + 1;
    const specs = pickN(ALL_SPECS, numSpecs, i * 5);

    const numCerts = i % 3;
    const certs = numCerts > 0 ? pickN(ALL_CERTS, numCerts, i * 11) : [];

    const numLangs = (i % 2) + 1;
    const extraLangs = pickN(ALL_LANGS.filter((l) => l !== 'de'), numLangs - 1, i * 7);
    const langs = ['de', ...extraLangs];

    const practice = practiceRecords[i % practiceRecords.length];

    const photoIndex = (i % 70) + 1;
    const photoGender = isFemale ? 'women' : 'men';
    const photo = `https://randomuser.me/api/portraits/${photoGender}/${photoIndex}.jpg`;

    await prisma.therapist.create({
      data: {
        email,
        fullName,
        professionalTitle: isFemale ? 'Physiotherapeutin' : 'Physiotherapeut',
        city: practice.city,
        bio: pick(BIOS, i),
        homeVisit: i % 3 !== 0,
        specializations: specs.join(', '),
        languages: langs.join(', '),
        certifications: certs.join(', '),
        kassenart: KASSENART_OPTIONS[i % KASSENART_OPTIONS.length],
        availability: pick(AVAILABILITY_OPTIONS, i * 13),
        reviewStatus: 'APPROVED',
        photo,
        links: {
          create: { practiceId: practice.id, status: 'CONFIRMED' },
        },
      },
    });
  }

  // ── Test-Account ──────────────────────────────────────────────────────────
  const testPasswordHash = await hashPassword('password');
  const testManagerUser = await prisma.user.findUnique({ where: { email: 'test@revio.de' } });
  const testTherapist = await prisma.therapist.create({
    data: {
      email: 'test@revio.de',
      userId: testManagerUser?.id,
      fullName: 'Test Therapeut',
      professionalTitle: 'Physiotherapeut',
      city: 'Köln',
      bio: 'Test-Konto für die Entwicklung.',
      homeVisit: true,
      specializations: 'Sportphysiotherapie, Rückentherapie',
      languages: 'de, en',
      certifications: 'MT',
      kassenart: 'gesetzlich',
      availability: 'Mo–Fr 8:00–18:00 Uhr',
      reviewStatus: 'APPROVED',
      passwordHash: testPasswordHash,
      links: {
        create: { practiceId: practiceRecords[0].id, status: 'CONFIRMED' },
      },
    },
  });

  // Link test therapist as manager of the first practice (update the existing PracticeManager)
  await prisma.practiceManager.update({
    where: { practiceId: practiceRecords[0].id },
    data: { therapistId: testTherapist.id },
  });

  // ── Notification für Test-User: Beitrittsanfrage an seine Praxis ──────────
  // Erstelle einen Therapeuten der eine Anfrage an "Physio & Motion" stellt
  const notifTherapist = await prisma.therapist.create({
    data: {
      email: 'sarah.mueller.notif@example.com',
      fullName: 'Sarah Müller',
      professionalTitle: 'Physiotherapeutin',
      city: 'Köln',
      bio: 'Schwerpunkt manuelle Therapie und Faszienbehandlung.',
      homeVisit: true,
      specializations: 'Manuelle Therapie, Faszientherapie',
      languages: 'de, en',
      certifications: 'MT, Faszientherapie',
      kassenart: 'Alle Kassen',
      availability: 'Mo–Fr 9:00–17:00 Uhr',
      reviewStatus: 'APPROVED',
    },
  });
  // PROPOSED-Link mit initiatedBy=THERAPIST → erscheint als JOIN_REQUEST für Test-User
  await prisma.therapistPracticeLink.create({
    data: {
      therapistId: notifTherapist.id,
      practiceId: practiceRecords[0].id,
      status: 'PROPOSED',
      initiatedBy: 'THERAPIST',
    },
  });

  // ── Pending-Eintrag für Admin-Queue ───────────────────────────────────────
  const pendingPractice = await prisma.practice.create({
    data: {
      name: 'Neuro Motion Lab',
      city: 'Köln',
      address: 'Aachener Str. 5, 50667 Köln',
      phone: '+49 221 654321',
      hours: 'Mo–Fr 9:00–18:00',
      lat: 50.95,
      lng: 6.97,
      logo: ensurePracticeLogoAsset('Neuro Motion Lab', 'Köln'),
      reviewStatus: 'PENDING_REVIEW',
    },
  });

  await prisma.therapist.create({
    data: {
      email: 'max.klein@example.com',
      fullName: 'Max Klein',
      professionalTitle: 'Physiotherapeut',
      city: 'Köln',
      bio: 'Neurologische Rehabilitation und Bobath-Therapie.',
      homeVisit: false,
      specializations: 'Neurologische Rehabilitation, Bobath-Therapie',
      languages: 'de',
      certifications: 'Bobath',
      kassenart: 'gesetzlich',
      reviewStatus: 'PENDING_REVIEW',
      links: {
        create: { practiceId: pendingPractice.id, status: 'PROPOSED' },
      },
    },
  });

  // ── SearchSuggestions ─────────────────────────────────────────────────────
  await (prisma as any).searchSuggestion.deleteMany();

  const suggestions: SuggestionRow[] = [];

  // Cities (weight 3)
  for (const city of CITY_NAMES) {
    suggestions.push({ text: city, normalized: normalizeText(city), type: 'CITY', weight: 3 });
  }

  // Specialties (weight 3)
  for (const spec of Array.from(new Set(ALL_SPECS))) {
    suggestions.push({ text: spec, normalized: normalizeText(spec), type: 'SPECIALTY', weight: 3 });
  }

  // Approved therapist names (weight 5)
  const approvedTherapists = await prisma.therapist.findMany({
    where: { reviewStatus: 'APPROVED' },
    select: { id: true, fullName: true },
  });
  for (const t of approvedTherapists) {
    suggestions.push({ text: t.fullName, normalized: normalizeText(t.fullName), type: 'THERAPIST_NAME', entityId: t.id, weight: 5 });
  }

  // Approved practice names (weight 4)
  const approvedPractices = await prisma.practice.findMany({
    where: { reviewStatus: 'APPROVED' },
    select: { id: true, name: true },
  });
  for (const p of approvedPractices) {
    suggestions.push({ text: p.name, normalized: normalizeText(p.name), type: 'PRACTICE_NAME', entityId: p.id, weight: 4 });
  }

  // Bulk insert in batches of 50
  for (let i = 0; i < suggestions.length; i += 50) {
    await (prisma as any).searchSuggestion.createMany({ data: suggestions.slice(i, i + 50) });
  }

  console.log(`  ${suggestions.length} SearchSuggestions indexed`);
  console.log('Seed complete.');
  console.log('  30 Praxen (APPROVED) mit Admin-Login');
  console.log('  100 Therapeuten (APPROVED) über 10 Städte verteilt');
  console.log('  1  Therapeut PENDING (Max Klein)');
  console.log('  1  Beitrittsanfrage (Sarah Müller → Physio & Motion) als Notification');
  console.log('  TEST: test@revio.de / password (Therapeut + Praxis-Admin von "Physio & Motion")');
  console.log('  (Übrige Praxen: admin@<praxis-slug>.de / praxis123)');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
