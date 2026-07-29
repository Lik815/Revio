import { getSiteApiBaseCandidates } from './api-base';

export type SiteSettings = {
  underConstruction: boolean;
  appBookingEnabled: boolean;
};

export async function getSiteSettings(): Promise<SiteSettings> {
  for (const base of getSiteApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}/config/site`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      return (await res.json()) as SiteSettings;
    } catch {
      continue;
    }
  }

  return { underConstruction: false, appBookingEnabled: false };
}
