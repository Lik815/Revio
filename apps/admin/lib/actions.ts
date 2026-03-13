'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN ?? '';
}

async function adminPost(path: string) {
  const token = await getAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
}

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('E-Mail oder Passwort ist falsch.');
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
  await adminPost(`/admin/therapists/${id}/approve`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function rejectTherapist(id: string) {
  await adminPost(`/admin/therapists/${id}/reject`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

export async function requestChangesTherapist(id: string) {
  await adminPost(`/admin/therapists/${id}/request-changes`);
  revalidatePath('/therapists');
}

export async function suspendTherapist(id: string) {
  await adminPost(`/admin/therapists/${id}/suspend`);
  revalidatePath('/therapists');
  revalidatePath('/');
}

// Practice actions
export async function approvePractice(id: string) {
  await adminPost(`/admin/practices/${id}/approve`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function rejectPractice(id: string) {
  await adminPost(`/admin/practices/${id}/reject`);
  revalidatePath('/practices');
  revalidatePath('/');
}

export async function suspendPractice(id: string) {
  await adminPost(`/admin/practices/${id}/suspend`);
  revalidatePath('/practices');
  revalidatePath('/');
}

// Link actions
export async function confirmLink(id: string) {
  await adminPost(`/admin/links/${id}/confirm`);
  revalidatePath('/links');
  revalidatePath('/');
}

export async function rejectLink(id: string) {
  await adminPost(`/admin/links/${id}/reject`);
  revalidatePath('/links');
  revalidatePath('/');
}

export async function disputeLink(id: string) {
  await adminPost(`/admin/links/${id}/dispute`);
  revalidatePath('/links');
}
