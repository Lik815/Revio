import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAMES = ['revio_admin_token', 'revio_admin_user'] as const;

function expireCookie(response: NextResponse, name: string, secure: boolean, domain?: string) {
  response.cookies.set(name, '', {
    domain,
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure,
  });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/login', requestUrl), 303);
  const hostname = requestUrl.hostname;
  const secure = requestUrl.protocol === 'https:';
  const parentDomain = hostname.endsWith('.my-revio.de') ? '.my-revio.de' : undefined;

  for (const name of ADMIN_COOKIE_NAMES) {
    expireCookie(response, name, secure);
    if (parentDomain) expireCookie(response, name, secure, parentDomain);
  }

  return response;
}
