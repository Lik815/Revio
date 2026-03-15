import type {
  AdminStats,
  TherapistWithLinks,
  PracticeWithLinks,
  LinkWithEntities,
} from '@revio/shared';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN ?? '';
}

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export type VisibilityIssue = {
  therapistId: string;
  fullName: string;
  visible: boolean;
  pendingPractices: { id: string; name: string; status: string }[];
  pendingLinks: { id: string; practiceId: string; status: string }[];
};

export type VisibilityIssues = {
  count: number;
  issues: VisibilityIssue[];
};

export const api = {
  getStats: () => adminFetch<AdminStats>('/admin/stats'),
  getTherapists: () => adminFetch<TherapistWithLinks[]>('/admin/therapists'),
  getPractices: () => adminFetch<PracticeWithLinks[]>('/admin/practices'),
  getLinks: () => adminFetch<LinkWithEntities[]>('/admin/links'),
  getVisibilityIssues: () => adminFetch<VisibilityIssues>('/admin/visibility-issues'),
};
