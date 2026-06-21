import type { PrismaClient } from '@prisma/client';

// Offizielle Heilmittel-Katalog-Kategorien — bewusst getrennt von
// DEFAULT_CERTIFICATION_OPTIONS (Fortbildungen). Eine spätere Verknüpfung
// der beiden Listen ist geplant, aber nicht Teil dieser Umsetzung.
export const DEFAULT_HEILMITTEL_OPTIONS = [
  { key: 'Blankoverordnung', label: 'Blankoverordnung', sortOrder: 10 },
  { key: 'KG', label: 'Krankengymnastik (KG)', sortOrder: 20 },
  { key: 'MT', label: 'Manuelle Therapie (MT)', sortOrder: 30 },
  { key: 'MLD30', label: 'Manuelle Lymphdrainage 30 min (MLD)', sortOrder: 40 },
  { key: 'MLD45', label: 'Manuelle Lymphdrainage 45 min (MLD)', sortOrder: 50 },
  { key: 'MLD60', label: 'Manuelle Lymphdrainage 60 min (MLD)', sortOrder: 60 },
  { key: 'Atemtherapie', label: 'Atemtherapie', sortOrder: 70 },
  { key: 'CMD', label: 'Craniomandibuläre Dysfunktion (CMD)', sortOrder: 80 },
  { key: 'Beckenbodenbehandlung', label: 'Beckenbodenbehandlung', sortOrder: 90 },
  { key: 'KGZNSErwachsene', label: 'KG-ZNS Erwachsene', sortOrder: 100 },
  { key: 'KGZNSKinder', label: 'KG-ZNS Kinder', sortOrder: 110 },
];

export async function ensureDefaultHeilmittelOptions(prisma: PrismaClient) {
  const count = await prisma.heilmittelOption.count();
  if (count > 0) return;

  for (const option of DEFAULT_HEILMITTEL_OPTIONS) {
    await prisma.heilmittelOption.upsert({
      where: { key: option.key },
      update: {},
      create: {
        ...option,
        isActive: true,
      },
    });
  }
}
