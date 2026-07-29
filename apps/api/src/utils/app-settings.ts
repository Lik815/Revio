type AppSettingStore = {
  appSetting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: string } | null>;
    upsert(args: {
      where: { key: string };
      create: { key: string; value: string };
      update: { value: string };
    }): Promise<unknown>;
  };
};

export const SITE_UNDER_CONSTRUCTION_KEY = 'site_under_construction';
// Gate für App-Bewerbung/Buchungs-CTA auf der Website (Directory-First-Refactor,
// Paket P1) — Default aus, solange Buchung nur in der App läuft.
export const APP_BOOKING_ENABLED_KEY = 'app_booking_enabled';

export async function getBooleanAppSetting(
  prisma: AppSettingStore,
  key: string,
  fallback = false,
) {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return fallback;

  return setting.value === 'true';
}

export async function setBooleanAppSetting(
  prisma: AppSettingStore,
  key: string,
  value: boolean,
) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value ? 'true' : 'false' },
    update: { value: value ? 'true' : 'false' },
  });
}

export async function getPublicSiteSettings(prisma: AppSettingStore) {
  return {
    underConstruction: await getBooleanAppSetting(prisma, SITE_UNDER_CONSTRUCTION_KEY, false),
    appBookingEnabled: await getBooleanAppSetting(prisma, APP_BOOKING_ENABLED_KEY, false),
  };
}
