import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '../components/admin-shell';
import { logoutAdmin } from '../lib/actions';

export const metadata: Metadata = {
  title: 'Revio Admin-Dashboard',
  description: 'Internes Dashboard zur Prüfung von Therapeut:innen- und Praxis-Einreichungen.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN;
  const userCookie = cookieStore.get('revio_admin_user')?.value;
  const adminUser = userCookie ? JSON.parse(userCookie) : { name: 'Revio Admin', email: process.env.REVIO_ADMIN_EMAIL ?? 'admin@revio.de', role: 'Super Admin' };

  if (!token) {
    redirect('/login');
  }

  return (
    <html lang="de">
      <body suppressHydrationWarning>
        <AdminShell adminUser={adminUser} onLogout={logoutAdmin}>{children}</AdminShell>
      </body>
    </html>
  );
}
