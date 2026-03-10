import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log('Seed complete.');
  console.log(`  APPROVED: ${annaBecker.fullName} @ ${praxisRheinFit.name}`);
  console.log(`  PENDING:  ${maxKlein.fullName} @ ${neuroMotionLab.name}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
