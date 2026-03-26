import type { PrismaClient } from '@prisma/client';

export const DEFAULT_CERTIFICATION_OPTIONS = [
  { key: 'MLD', label: 'Manuelle Lymphdrainage (MLD)', sortOrder: 10 },
  { key: 'MT', label: 'Manuelle Therapie (MT)', sortOrder: 20 },
  { key: 'BobathKinder', label: 'KG-ZNS Kinder nach Bobath', sortOrder: 30 },
  { key: 'VojtaKinder', label: 'KG-ZNS Kinder nach Vojta', sortOrder: 40 },
  { key: 'Bobath', label: 'KG-ZNS Erwachsene nach Bobath', sortOrder: 50 },
  { key: 'Vojta', label: 'KG-ZNS Erwachsene nach Vojta', sortOrder: 60 },
  { key: 'PNF', label: 'KG-ZNS Erwachsene nach PNF', sortOrder: 70 },
  { key: 'KGG', label: 'KG-Gerät', sortOrder: 80 },
];

export async function ensureDefaultCertificationOptions(prisma: PrismaClient) {
  const count = await prisma.certificationOption.count();
  if (count > 0) return;

  for (const option of DEFAULT_CERTIFICATION_OPTIONS) {
    await prisma.certificationOption.upsert({
      where: { key: option.key },
      update: {},
      create: {
        ...option,
        isActive: true,
      },
    });
  }
}
