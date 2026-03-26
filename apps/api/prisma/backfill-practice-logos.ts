import { PrismaClient } from '@prisma/client';
import { ensurePracticeLogoAsset, shouldRefreshPracticeLogo } from './practice-logo.js';

const prisma = new PrismaClient();

async function main() {
  const practices = await prisma.practice.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      logo: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let added = 0;
  let refreshed = 0;
  let skipped = 0;

  for (const practice of practices) {
    if (!shouldRefreshPracticeLogo(practice.logo, practice.name, practice.city)) {
      skipped++;
      continue;
    }

    const nextLogo = ensurePracticeLogoAsset(practice.name, practice.city, { force: true });

    await prisma.practice.update({
      where: { id: practice.id },
      data: { logo: nextLogo },
    });

    if (!practice.logo || practice.logo.trim() === '') added++;
    else refreshed++;
  }

  const withLogo = await prisma.practice.count({
    where: {
      NOT: {
        OR: [
          { logo: null },
          { logo: '' },
        ],
      },
    },
  });

  console.log('Practice logo backfill complete.');
  console.log(`  Logos added now: ${added}`);
  console.log(`  Logos refreshed now: ${refreshed}`);
  console.log(`  Practices skipped: ${skipped}`);
  console.log(`  Practices with logo: ${withLogo}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
