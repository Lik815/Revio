import type { PrismaClient } from '@prisma/client';

function splitCsv(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/** heilmittelKeys where isActive=true for this therapist */
export async function getActiveTherapistServiceKeys(
  prisma: PrismaClient,
  therapistId: string,
): Promise<string[]> {
  const rows = await prisma.therapistService.findMany({
    where: { therapistId, isActive: true },
    select: { heilmittelKey: true },
  });
  return rows.map(r => r.heilmittelKey);
}

/**
 * All heilmittelKeys offered by this therapist.
 * Prefers active TherapistService rows; falls back to therapist.heilmittel CSV.
 * Normalizes legacy label-based CSV entries to canonical keys.
 */
export async function getTherapistOfferedHeilmittelKeys(
  prisma: PrismaClient,
  therapist: { id: string; heilmittel?: string | null },
): Promise<string[]> {
  const activeKeys = await getActiveTherapistServiceKeys(prisma, therapist.id);
  if (activeKeys.length > 0) return activeKeys;

  const legacyItems = splitCsv((therapist as any).heilmittel ?? '');
  if (legacyItems.length === 0) return [];

  const options = await prisma.heilmittelOption.findMany({
    where: { OR: [{ key: { in: legacyItems } }, { label: { in: legacyItems } }] },
    select: { key: true },
  });
  return options.length > 0 ? options.map(o => o.key) : legacyItems;
}

/**
 * Syncs therapist.heilmittel (legacy CSV) from active TherapistService rows.
 * Call after any change to isActive on TherapistService.
 */
export async function syncTherapistHeilmittelFromServices(
  prisma: PrismaClient,
  therapistId: string,
): Promise<void> {
  const active = await prisma.therapistService.findMany({
    where: { therapistId, isActive: true },
    select: { heilmittelKey: true },
    orderBy: { heilmittelKey: 'asc' },
  });
  const csv = active.map(r => r.heilmittelKey).join(', ');
  await (prisma.therapist as any).update({
    where: { id: therapistId },
    data: { heilmittel: csv },
  });
}
