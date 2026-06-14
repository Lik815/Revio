import { Prisma, type PrismaClient } from '@prisma/client';

const labels = [
  'Rückenschmerzen',
  'Kniereha',
  'Schulterrehabilitation',
  'Nackenschmerzen',
  'Hüftreha',
  'Fußtherapie',
  'Sportphysiotherapie',
  'Orthopädische Rehabilitation',
  'Neurologische Rehabilitation',
  'Manualtherapie',
  'Postoperative Reha',
  'Lymphdrainage',
  'Beckenbodentherapie',
  'Wirbelsäulentherapie',
  'Handtherapie',
  'Pädiatrische Physiotherapie',
  'Geriatrische Rehabilitation',
  'Atemtherapie',
  'Krankengymnastik',
  'Osteopathie',
  'Kinesiotaping',
  'Dry Needling',
  'Triggerpunkt-Therapie',
  'Vojta-Therapie',
  'Bobath-Therapie',
  'Aquatherapie',
  'Entspannungstherapie',
];

export function createSpecializationKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const DEFAULT_SPECIALIZATION_OPTIONS = labels.map((label, index) => ({
  key: createSpecializationKey(label),
  label,
  sortOrder: (index + 1) * 10,
}));

export function getDefaultSpecializationOptions() {
  return DEFAULT_SPECIALIZATION_OPTIONS.map((option) => ({
    ...option,
    isActive: true,
  }));
}

export function isSpecializationOptionStorageError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2021'
  ) {
    return true;
  }

  if (!(error instanceof Error)) return false;
  return (
    /specializationoption/i.test(error.message)
    && /(does not exist|no such table|invalid `prisma\.specializationOption|table)/i.test(error.message)
  );
}

export async function ensureDefaultSpecializationOptions(prisma: PrismaClient) {
  const count = await prisma.specializationOption.count();
  if (count > 0) return;

  for (const option of DEFAULT_SPECIALIZATION_OPTIONS) {
    await prisma.specializationOption.upsert({
      where: { key: option.key },
      update: {},
      create: {
        ...option,
        isActive: true,
      },
    });
  }
}
