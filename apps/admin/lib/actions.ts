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
  return cookieStore.get('revio_admin_token')?.value ?? process.env.REVIO_ADMIN_TOKEN ?? process.env.ADMIN_TOKEN ?? '';
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

export async function confirmLink(id: string) {
  await adminRequest(`/admin/links/${id}/confirm`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

export async function rejectLink(id: string) {
  await adminRequest(`/admin/links/${id}/reject`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
}

export async function disputeLink(id: string) {
  await adminRequest(`/admin/links/${id}/dispute`);
  revalidatePath('/links');
  revalidatePath('/therapists');
  revalidatePath('/practices');
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

// Heilmittel option actions
export async function createHeilmittelOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/heilmittel', {
    body: { label },
  });
  revalidatePath('/heilmittel');
}

export async function updateHeilmittelOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/heilmittel/${id}/update`, {
    body: { label },
  });
  revalidatePath('/heilmittel');
}

export async function toggleHeilmittelOption(id: string) {
  await adminRequest(`/admin/heilmittel/${id}/toggle`);
  revalidatePath('/heilmittel');
}

export async function deleteHeilmittelOption(id: string) {
  await adminRequest(`/admin/heilmittel/${id}/delete`);
  revalidatePath('/heilmittel');
}

// Specialization option actions
export async function createSpecializationOption(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest('/admin/specializations', {
    body: { label },
  });
  revalidatePath('/specializations');
}

export async function updateSpecializationOption(id: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await adminRequest(`/admin/specializations/${id}/update`, {
    body: { label },
  });
  revalidatePath('/specializations');
}

export async function toggleSpecializationOption(id: string) {
  await adminRequest(`/admin/specializations/${id}/toggle`);
  revalidatePath('/specializations');
}

export async function deleteSpecializationOption(id: string) {
  await adminRequest(`/admin/specializations/${id}/delete`);
  revalidatePath('/specializations');
}

export async function updateSiteUnderConstruction(formData: FormData) {
  const value = String(formData.get('underConstruction') ?? '').trim();
  const underConstruction = value === 'true';

  await adminRequest('/admin/site-settings/update', {
    body: { underConstruction },
  });

  revalidatePath('/settings');
}

export async function updateAppFeedbackStatus(id: string, formData: FormData) {
  const status = String(formData.get('status') ?? '').trim();
  if (status !== 'NEW' && status !== 'RESOLVED') return;

  await adminRequest(`/admin/feedback/${id}/status`, {
    body: { status },
  });

  revalidatePath('/feedback');
}

function slugifyBlogTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function createBlogPost(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim();
  const excerpt = String(formData.get('excerpt') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const authorName = String(formData.get('authorName') ?? 'Revio Team').trim() || 'Revio Team';
  const slug = slugInput || slugifyBlogTitle(title);

  if (!slug || !title || !excerpt || !content) return;

  await adminRequest('/admin/blog-posts', {
    body: { slug, title, excerpt, content, authorName },
  });

  revalidatePath('/blog');
}

export async function updateBlogPost(id: string, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim();
  const excerpt = String(formData.get('excerpt') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const authorName = String(formData.get('authorName') ?? 'Revio Team').trim() || 'Revio Team';
  const slug = slugInput || slugifyBlogTitle(title);

  if (!slug || !title || !excerpt || !content) return;

  await adminRequest(`/admin/blog-posts/${id}/update`, {
    body: { slug, title, excerpt, content, authorName },
  });

  revalidatePath('/blog');
}

export async function toggleBlogPostPublish(id: string) {
  await adminRequest(`/admin/blog-posts/${id}/toggle-publish`);
  revalidatePath('/blog');
}

export async function deleteBlogPost(id: string) {
  await adminRequest(`/admin/blog-posts/${id}/delete`);
  revalidatePath('/blog');
}
