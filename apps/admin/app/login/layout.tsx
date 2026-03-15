import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function LoginLayout({ children }: { children: ReactNode }) {
  // Already logged in → go to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get('revio_admin_token')?.value;
  if (token) {
    redirect('/');
  }

  return <>{children}</>;
}
