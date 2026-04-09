import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { MaintenanceScreen } from '../components/maintenance-screen';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { getSiteSettings } from '../lib/site-settings';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://my-revio.de';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Revio – Physiotherapie digital finden',
    template: '%s | Revio',
  },
  description: 'Revio hilft Ihnen, passende Physiotherapeut:innen in Deutschland schnell und unkompliziert zu finden.',
  openGraph: {
    siteName: 'Revio',
    locale: 'de_DE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Layout must stay dynamic because getSiteSettings() drives the maintenance gate.
// Individual page segments override revalidation with their own `revalidate` export.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const siteSettings = await getSiteSettings();

  return (
    <html lang="de">
      <body suppressHydrationWarning>
        {siteSettings.underConstruction ? (
          <MaintenanceScreen />
        ) : (
          <div className="site-chrome">
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </div>
        )}
      </body>
    </html>
  );
}
