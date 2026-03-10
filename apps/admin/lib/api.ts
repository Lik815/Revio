import type {
  AdminStats,
  TherapistWithLinks,
  PracticeWithLinks,
  LinkWithEntities,
} from '@revio/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  getStats: () => adminFetch<AdminStats>('/admin/stats'),
  getTherapists: () => adminFetch<TherapistWithLinks[]>('/admin/therapists'),
  getPractices: () => adminFetch<PracticeWithLinks[]>('/admin/practices'),
  getLinks: () => adminFetch<LinkWithEntities[]>('/admin/links'),
};
