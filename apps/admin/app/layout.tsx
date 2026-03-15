import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Revio Admin-Dashboard',
  description: 'Internes Dashboard zur Prüfung von Therapeut:innen- und Praxis-Einreichungen.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
