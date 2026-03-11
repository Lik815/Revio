import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function main() {
  await prisma.therapistPracticeLink.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.practice.deleteMany();

  // Approved practice + therapist (visible in search)
  const praxisRheinFit = await prisma.practice.create({
    data: {
      name: 'Praxis RheinFit',
      city: 'Köln',
      address: 'Hohenzollernring 12, 50672 Köln',
      phone: '+49 221 123456',
      lat: 50.9375,
      lng: 6.9603,
      reviewStatus: 'APPROVED',
    },
  });

  const annaBecker = await prisma.therapist.create({
    data: {
      email: 'anna.becker@example.com',
      fullName: 'Anna Becker',
      professionalTitle: 'Physiotherapeutin',
      city: 'Köln',
      bio: 'Spezialisiert auf Rückentherapie und Sportphysiotherapie.',
      homeVisit: true,
      specializations: 'back pain, sports physiotherapy, manual therapy',
      languages: 'de, en',
      certifications: 'MT, KGG',
      reviewStatus: 'APPROVED',
      links: {
        create: { practiceId: praxisRheinFit.id, status: 'CONFIRMED' },
      },
    },
  });

  // Pending practice + therapist (visible in admin queue)
  const neuroMotionLab = await prisma.practice.create({
    data: {
      name: 'Neuro Motion Lab',
      city: 'Köln',
      address: 'Aachener Str. 5, 50667 Köln',
      phone: '+49 221 654321',
      lat: 50.95,
      lng: 6.97,
      reviewStatus: 'PENDING_REVIEW',
    },
  });

  const maxKlein = await prisma.therapist.create({
    data: {
      email: 'max.klein@example.com',
      fullName: 'Max Klein',
      professionalTitle: 'Physiotherapeut',
      city: 'Köln',
      bio: 'Neurologische Rehabilitation und Bobath-Therapie.',
      homeVisit: false,
      specializations: 'neurological rehab, bobath',
      languages: 'de',
      certifications: 'Bobath',
      reviewStatus: 'PENDING_REVIEW',
      links: {
        create: { practiceId: neuroMotionLab.id, status: 'PROPOSED' },
      },
    },
  });

  // Test account (dev login)
  const testPasswordHash = await hashPassword('password');
  const testTherapist = await prisma.therapist.create({
    data: {
      email: 'test@revio.de',
      fullName: 'Test Therapeut',
      professionalTitle: 'Physiotherapeut',
      city: 'Köln',
      bio: 'Test-Konto für die Entwicklung.',
      homeVisit: true,
      specializations: 'Sportphysiotherapie, Rückentherapie',
      languages: 'de, en',
      certifications: 'MT',
      reviewStatus: 'APPROVED',
      passwordHash: testPasswordHash,
      links: {
        create: { practiceId: praxisRheinFit.id, status: 'CONFIRMED' },
      },
    },
  });

  console.log('Seed complete.');
  console.log(`  APPROVED: ${annaBecker.fullName} @ ${praxisRheinFit.name}`);
  console.log(`  PENDING:  ${maxKlein.fullName} @ ${neuroMotionLab.name}`);
  console.log(`  TEST:     ${testTherapist.fullName} — login: test@revio.de / password`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
