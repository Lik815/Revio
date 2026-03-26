'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiBaseCandidates } from './api-base';

export type LoginState = {
  error: string | null;
};

async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN ?? '';
}

async function adminRequest(path: string, init?: { method?: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) {
  const token = await getAdminToken();
  let lastError: unknown;

  for (const base of getApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: init?.method ?? 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(`API nicht erreichbar: ${path}`);
}

export async function loginAdmin(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  let res: Response | null = null;

  for (const base of getApiBaseCandidates()) {
    try {
      res = await fetch(`${base}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
      });
      break;
    } catch {
      continue;
    }
  }

  if (!res) {
    return { error: 'Die Admin-API ist aktuell nicht erreichbar. Bitte pruefe, ob sie lokal laeuft.' };
  }

  if (!res.ok) {
    return { error: 'E-Mail oder Passwort ist falsch.' };
  }

  const data = await res.json();
  const cookieStore = await cookies();
  cookieStore.set('revio_admin_token', data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });
  cookieStore.set('revio_admin_user', JSON.stringify(data.admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  });

  redirect('/');
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('revio_admin_token');
  cookieStore.delete('revio_admin_user');
  redirect('/login');
}

// Therapist actions
export async function approveTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/approve`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function rejectTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/reject`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function requestChangesTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/request-changes`);
  revalidatePath('/therapists');
}

export async function suspendTherapist(id: string) {
  await adminRequest(`/admin/therapists/${id}/suspend`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

// Practice actions
export async function approvePractice(id: string) {
  await adminRequest(`/admin/practices/${id}/approve`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function rejectPractice(id: string) {
  await adminRequest(`/admin/practices/${id}/reject`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function suspendPractice(id: string) {
  await adminRequest(`/admin/practices/${id}/suspend`);
  revalidatePath('/practices');
  revalidatePath('/');
}

// Link actions
export async function confirmLink(id: string) {
  await adminRequest(`/admin/links/${id}/confirm`);
  revalidatePath('/links');
  revalidatePath('/');
}

export async function rejectLink(id: string) {
  await adminRequest(`/admin/links/${id}/reject`);
  revalidatePath('/links');
  revalidatePath('/');
}

export async function disputeLink(id: string) {
  await adminRequest(`/admin/links/${id}/dispute`);
  revalidatePath('/links');
}

// Certification option actions
export async function createCertificationOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/certifications', {
    body: { label },
  });
  revalidatePath('/settings');
}

export async function updateCertificationOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/certifications/${id}/update`, {
    body: { label },
  });
  revalidatePath('/settings');
}

export async function toggleCertificationOption(id: string) {
  await adminRequest(`/admin/certifications/${id}/toggle`);
  revalidatePath('/settings');
}

export async function deleteCertificationOption(id: string) {
  await adminRequest(`/admin/certifications/${id}/delete`);
  revalidatePath('/settings');
}
