import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '../../components/admin-shell';
import { logoutAdmin } from '../../lib/actions';
import { getAdminSessionState } from '../../lib/api';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('revio_admin_token')?.value;
  const userCookie = cookieStore.get('revio_admin_user')?.value;

  if (!token) {
    redirect('/login');
  }

  const session = await getAdminSessionState();
  if (session.unauthorized) {
    cookieStore.delete('revio_admin_token');
    cookieStore.delete('revio_admin_user');
    redirect('/login');
  }

  const cookieUser = userCookie
    ? JSON.parse(userCookie)
    : { name: 'Revio Admin', email: 'admin@revio.de', role: 'Super Admin' };
  const adminUser = session.adminUser ?? cookieUser;

  return (
    <AdminShell adminUser={adminUser} onLogout={logoutAdmin} apiUnavailable={!session.available}>
      {children}
    </AdminShell>
  );
}
