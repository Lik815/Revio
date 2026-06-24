import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAMES = ['revio_admin_token', 'revio_admin_user'] as const;

function expiredCookieHeader(name: string, secure: boolean, domain?: string) {
  const parts = [
    `${name}=`,
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');

  return parts.join('; ');
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/login', requestUrl), 303);
  const hostname = requestUrl.hostname;
  const secure = requestUrl.protocol === 'https:';
  const parentDomain = hostname.endsWith('.my-revio.de') ? '.my-revio.de' : undefined;

  for (const name of ADMIN_COOKIE_NAMES) {
    // Login historically wrote host-only cookies. Also clear the parent-domain
    // variant so old sessions from earlier deployments cannot survive logout.
    response.headers.append('Set-Cookie', expiredCookieHeader(name, secure));
    if (parentDomain) {
      response.headers.append('Set-Cookie', expiredCookieHeader(name, secure, parentDomain));
    }
  }

  return response;
}
