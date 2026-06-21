import { getSiteApiBaseCandidates } from './api-base';

const FETCH_TIMEOUT_MS = 8000;

// `getSiteApiBaseCandidates()` is ordered server-reachability-first
// (INTERNAL_API_URL before NEXT_PUBLIC_API_URL) — correct for the data
// fetches below, which run on the server. Media URLs end up in HTML the
// browser fetches directly, so they must use the public base instead.
function getPublicMediaBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') ||
    process.env.API_BASE_URL?.trim().replace(/\/$/, '') ||
    'http://localhost:4000'
  );
}

function resolveMediaUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  return value.startsWith('/') ? `${getPublicMediaBase()}${value}` : value;
}

async function fetchFromApi(path: string, init?: RequestInit): Promise<any | null> {
  for (const base of getSiteApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

// ── Site-local view models ──────────────────────────────────────────────
// Intentionally smaller than the mobile app's mapped shape — only what the
// public website actually renders.

export type PublicPractice = {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  hours?: string;
  description?: string;
  logo?: string;
  photos?: string[];
  distKm?: number;
};

export type PublicTherapist = {
  id: string;
  fullName: string;
  professionalTitle: string;
  photo?: string;
  city: string;
  bio?: string;
  homeVisit: boolean;
  serviceRadiusKm?: number | null;
  languages: string[];
  kassenart: string;
  specializations: string[];
  certifications: string[];
  heilmittel: string[];
  practices: PublicPractice[];
  bookingMode?: string;
  requestable: boolean;
  nextFreeSlotAt?: string | null;
  phone?: string | null;
  email?: string;
  distKm?: number;
};

function normalizePractice(raw: any): PublicPractice {
  return {
    id: raw.id,
    name: raw.name ?? '',
    city: raw.city ?? '',
    address: raw.address || undefined,
    phone: raw.phone || undefined,
    hours: raw.hours || undefined,
    description: raw.description || undefined,
    logo: resolveMediaUrl(raw.logo),
    photos: Array.isArray(raw.photos)
      ? (raw.photos.map((p: string) => resolveMediaUrl(p)).filter(Boolean) as string[])
      : undefined,
    distKm: typeof raw.distKm === 'number' ? raw.distKm : undefined,
  };
}

function normalizeTherapist(raw: any): PublicTherapist {
  return {
    id: raw.id,
    fullName: raw.fullName ?? '',
    professionalTitle: raw.professionalTitle ?? '',
    photo: resolveMediaUrl(raw.photo),
    city: raw.city ?? '',
    bio: raw.bio || undefined,
    homeVisit: Boolean(raw.homeVisit),
    serviceRadiusKm: raw.serviceRadiusKm ?? null,
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    kassenart: raw.kassenart ?? '',
    specializations: Array.isArray(raw.specializations) ? raw.specializations : [],
    certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
    heilmittel: Array.isArray(raw.heilmittel) ? raw.heilmittel : [],
    practices: Array.isArray(raw.practices) ? raw.practices.map(normalizePractice) : [],
    bookingMode: raw.bookingMode,
    requestable: Boolean(raw.requestable),
    nextFreeSlotAt: raw.nextFreeSlotAt ?? null,
    phone: raw.phone ?? null,
    email: raw.email || undefined,
    distKm: typeof raw.distKm === 'number' ? raw.distKm : undefined,
  };
}

export type SearchInput = {
  query: string;
  city: string;
  homeVisit?: boolean;
  kassenart?: string;
};

export type SearchResult = {
  therapists: PublicTherapist[];
  practices: PublicPractice[];
};

// The API requires `city` (or `origin`, which the website doesn't collect
// in this first pass) — callers must not call this without a non-empty city.
export async function searchTherapists(input: SearchInput): Promise<SearchResult> {
  const data = await fetchFromApi('/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      city: input.city,
      homeVisit: input.homeVisit || undefined,
      kassenart: input.kassenart || undefined,
    }),
  });
  if (!data) return { therapists: [], practices: [] };
  return {
    therapists: Array.isArray(data.therapists) ? data.therapists.map(normalizeTherapist) : [],
    practices: Array.isArray(data.practices) ? data.practices.map(normalizePractice) : [],
  };
}

export async function getPublicTherapist(id: string): Promise<PublicTherapist | null> {
  const data = await fetchFromApi(`/therapist/${encodeURIComponent(id)}`);
  if (!data?.therapist) return null;
  return normalizeTherapist(data.therapist);
}

export async function getPublicPractice(
  id: string,
): Promise<{ practice: PublicPractice; therapists: PublicTherapist[] } | null> {
  const data = await fetchFromApi(`/practice-detail/${encodeURIComponent(id)}`);
  if (!data?.practice) return null;
  return {
    practice: normalizePractice(data.practice),
    therapists: Array.isArray(data.therapists) ? data.therapists.map(normalizeTherapist) : [],
  };
}
