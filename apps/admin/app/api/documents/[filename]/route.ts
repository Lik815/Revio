import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseCandidates } from '../../../../lib/api-base';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get('revio_admin_token')?.value ?? process.env.ADMIN_TOKEN ?? '';

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const bases = getApiBaseCandidates();
  let lastError: unknown;

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/admin/documents/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) return new NextResponse('Unauthorized', { status: 401 });
      if (res.status === 404) return new NextResponse('Not found', { status: 404 });
      if (!res.ok) return new NextResponse('Error', { status: res.status });

      const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream';
      const disposition = res.headers.get('Content-Disposition') ?? 'inline';

      return new NextResponse(res.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
        },
      });
    } catch (err) {
      lastError = err;
    }
  }

  console.error('Document proxy failed:', lastError);
  return new NextResponse('API not reachable', { status: 502 });
}
