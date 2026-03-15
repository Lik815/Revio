import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '../../components/admin-shell';
import { logoutAdmin } from '../../lib/actions';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  // Nur das Cookie zählt — kein process.env Fallback
  const token = cookieStore.get('revio_admin_token')?.value;
  const userCookie = cookieStore.get('revio_admin_user')?.value;

  if (!token) {
    redirect('/login');
  }

  const adminUser = userCookie
    ? JSON.parse(userCookie)
    : { name: 'Revio Admin', email: 'admin@revio.de', role: 'Super Admin' };

  return (
    <AdminShell adminUser={adminUser} onLogout={logoutAdmin}>
      {children}
    </AdminShell>
  );
}
