import type {
  AppFeedback,
  AdminStats,
  TherapistWithLinks,
} from '@revio/shared';
import { cookies } from 'next/headers';
import { getApiBaseCandidates } from './api-base';

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
  return cookieStore.get('revio_admin_token')?.value ?? '';
}

async function adminFetch<T>(path: string): Promise<T> {
  const token = await getAdminToken();
  const apiBases = getApiBaseCandidates();

  let lastNetworkError: unknown;

  for (const base of apiBases) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
      } catch (error) {
        lastNetworkError = error;
        if (attempt === 0) continue;
        break;
      }

      if (res.status === 401) throw new AdminApiError(`API 401: ${path}`, 'unauthorized', 401);
      if (!res.ok) throw new AdminApiError(`API ${res.status}: ${path}`, 'http', res.status);
      return res.json() as Promise<T>;
    }
  }

  const details = lastNetworkError instanceof Error ? ` (${lastNetworkError.message})` : '';
  throw new AdminApiError(`API nicht erreichbar: ${path}${details}`, 'network');
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
  therapistName: string;
  email: string;
  reason: string;
  detail: string;
  linkedPractices: { id: string; name: string; status: string; reviewStatus: string }[];
};

export type VisibilityIssues = {
  count: number;
  issues: VisibilityIssue[];
};

export type TherapistDocument = {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  uploadedAt: string;
};

export type CertificationOption = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

export type SpecializationOption = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
};

export type HeilmittelOption = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

export type SiteSettings = {
  underConstruction: boolean;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPractice = {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  reviewStatus: string;
  createdAt: string;
  links?: Array<{
    id: string;
    status: string;
    therapist: {
      id: string;
      fullName: string;
      professionalTitle: string;
    };
  }>;
};

export type AdminLink = {
  id: string;
  therapistId: string;
  practiceId: string;
  status: string;
  createdAt: string;
  therapist: {
    id: string;
    fullName: string;
    professionalTitle: string;
    reviewStatus?: string;
  };
  practice: {
    id: string;
    name: string;
    city: string;
    reviewStatus?: string;
  };
};

export const api = {
  getAppFeedback: () => adminFetch<AppFeedback[]>('/admin/feedback'),
  getStats: () => adminFetch<AdminStats>('/admin/stats'),
  getPractices: () => adminFetch<AdminPractice[]>('/admin/practices'),
  getLinks: () => adminFetch<AdminLink[]>('/admin/links'),
  getTherapists: () => adminFetch<TherapistWithLinks[]>('/admin/therapists'),
  getTherapist: (id: string) => adminFetch<TherapistWithLinks>(`/admin/therapists/${id}`),
  getVisibilityIssues: () => adminFetch<VisibilityIssues>('/admin/visibility-issues'),
  getSiteSettings: () => adminFetch<SiteSettings>('/admin/site-settings'),
  getBlogPosts: () => adminFetch<BlogPost[]>('/admin/blog-posts'),
  getTherapistDocuments: (id: string) => adminFetch<TherapistDocument[]>(`/admin/therapists/${id}/documents`),
  getCertificationOptions: () => adminFetch<{ certifications: CertificationOption[] }>('/admin/certifications'),
  getSpecializationOptions: () => adminFetch<{ specializations: SpecializationOption[] }>('/admin/specializations'),
  getHeilmittelOptions: () => adminFetch<{ heilmittel: HeilmittelOption[] }>('/admin/heilmittel'),
};
