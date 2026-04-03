const DEFAULT_PUBLIC_API_URL = 'http://localhost:4000';
const DEFAULT_INTERNAL_API_URL = 'http://127.0.0.1:4000';

function normalizeUrl(url?: string) {
  return url?.trim().replace(/\/$/, '');
}

export function getApiBaseCandidates() {
  const candidates = [
    normalizeUrl(process.env.INTERNAL_API_URL),
    normalizeUrl(process.env.NEXT_PUBLIC_API_URL),
    DEFAULT_PUBLIC_API_URL,
    DEFAULT_INTERNAL_API_URL,
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

