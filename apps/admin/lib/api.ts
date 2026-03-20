import type {
  AdminStats,
  TherapistWithLinks,
  PracticeWithLinks,
  LinkWithEntities,
} from '@revio/shared';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class AdminApiError extends Error {
  status?: number;
  kind: 'unauthorized' | 'network' | 'http';

  constructor(message: string, kind: 'unauthorized' | 'network' | 'http', status?: number) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.status = status;
  }
}

export type AdminSessionState = {
  available: boolean;
  unauthorized: boolean;
  adminUser: { name: string; email: string; role: string } | null;
};

async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN ?? '';
}

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    throw new AdminApiError(`API nicht erreichbar: ${path}`, 'network');
  }
  if (res.status === 401) throw new AdminApiError(`API 401: ${path}`, 'unauthorized', 401);
  if (!res.ok) throw new AdminApiError(`API ${res.status}: ${path}`, 'http', res.status);
  return res.json() as Promise<T>;
}

export async function getAdminSessionState(): Promise<AdminSessionState> {
  const token = await getAdminToken();
  if (!token) {
    return { available: true, unauthorized: true, adminUser: null };
  }

  try {
    const data = await adminFetch<{ admin: { name: string; email: string; role: string } }>('/admin/me');
    return { available: true, unauthorized: false, adminUser: data.admin };
  } catch (error) {
    if (error instanceof AdminApiError && error.kind === 'unauthorized') {
      return { available: true, unauthorized: true, adminUser: null };
    }
    return { available: false, unauthorized: false, adminUser: null };
  }
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

export type PracticeManager = {
  id: string;
  email: string;
  createdAt: string;
  practiceId: string;
  therapistId: string | null;
  practice: { id: string; name: string; city: string; reviewStatus: string };
  therapist: { id: string; fullName: string; email: string; reviewStatus: string } | null;
};

export type ManagersResponse = {
  managers: PracticeManager[];
};

export const api = {
  getStats: () => adminFetch<AdminStats>('/admin/stats'),
  getTherapists: () => adminFetch<TherapistWithLinks[]>('/admin/therapists'),
  getPractices: () => adminFetch<PracticeWithLinks[]>('/admin/practices'),
  getLinks: () => adminFetch<LinkWithEntities[]>('/admin/links'),
  getVisibilityIssues: () => adminFetch<VisibilityIssues>('/admin/visibility-issues'),
  getManagers: () => adminFetch<ManagersResponse>('/admin/managers'),
};
