'use server';

import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

async function adminPost(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
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
