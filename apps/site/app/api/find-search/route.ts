import { NextResponse } from 'next/server';
import { searchTherapists, type SearchInput } from '../../../lib/public-api';

type FindSearchRequest = {
  query?: unknown;
  city?: unknown;
  origin?: unknown;
  radiusKm?: unknown;
  homeVisit?: unknown;
  kassenart?: unknown;
};

const ALLOWED_KASSENARTEN = new Set([
  'gesetzlich',
  'privat',
  'selbstzahler',
  'privat_selbstzahler',
]);

function parseOrigin(value: unknown): SearchInput['origin'] {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { lat?: unknown; lng?: unknown };
  if (
    typeof candidate.lat !== 'number' ||
    !Number.isFinite(candidate.lat) ||
    typeof candidate.lng !== 'number' ||
    !Number.isFinite(candidate.lng) ||
    Math.abs(candidate.lat) > 90 ||
    Math.abs(candidate.lng) > 180
  ) {
    return undefined;
  }
  return { lat: candidate.lat, lng: candidate.lng };
}

export async function POST(request: Request) {
  let body: FindSearchRequest;
  try {
    body = (await request.json()) as FindSearchRequest;
  } catch {
    return NextResponse.json({ error: 'Ungültige Suchanfrage.' }, { status: 400 });
  }

  if (typeof body.query !== 'string' || !body.query.trim()) {
    return NextResponse.json({ error: 'Bitte einen Suchbegriff eingeben.' }, { status: 400 });
  }
  const query = body.query.trim();
  if (query.length > 120) {
    return NextResponse.json({ error: 'Der Suchbegriff ist zu lang.' }, { status: 400 });
  }

  if (body.city !== undefined && typeof body.city !== 'string') {
    return NextResponse.json({ error: 'Ungültiger Ort.' }, { status: 400 });
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  if (city.length > 100) {
    return NextResponse.json({ error: 'Der Ort ist zu lang.' }, { status: 400 });
  }

  if (body.homeVisit !== undefined && typeof body.homeVisit !== 'boolean') {
    return NextResponse.json({ error: 'Ungültiger Hausbesuchsfilter.' }, { status: 400 });
  }

  if (body.kassenart !== undefined && typeof body.kassenart !== 'string') {
    return NextResponse.json({ error: 'Ungültige Kassenart.' }, { status: 400 });
  }
  const kassenart = typeof body.kassenart === 'string' ? body.kassenart.trim() : '';
  if (kassenart && !ALLOWED_KASSENARTEN.has(kassenart)) {
    return NextResponse.json({ error: 'Ungültige Kassenart.' }, { status: 400 });
  }

  const origin = parseOrigin(body.origin);
  if (body.origin !== undefined && !origin) {
    return NextResponse.json({ error: 'Ungültiger Standort.' }, { status: 400 });
  }

  const radiusKm =
    typeof body.radiusKm === 'number' &&
    Number.isFinite(body.radiusKm) &&
    body.radiusKm > 0 &&
    body.radiusKm <= 100
      ? body.radiusKm
      : undefined;

  if (body.radiusKm !== undefined && radiusKm === undefined) {
    return NextResponse.json({ error: 'Ungültiger Suchradius.' }, { status: 400 });
  }
  if (Boolean(origin) !== Boolean(radiusKm)) {
    return NextResponse.json({ error: 'Standort und Suchradius müssen gemeinsam angegeben werden.' }, { status: 400 });
  }

  let results;
  try {
    results = await searchTherapists(
      {
        query,
        city: city || undefined,
        origin,
        radiusKm,
        // In the public search UI an unchecked checkbox means "no filter", not
        // "only therapists without home visits".
        homeVisit: body.homeVisit === true ? true : undefined,
        kassenart: kassenart || undefined,
      },
      { throwOnFailure: true },
    );
  } catch {
    return NextResponse.json(
      { error: 'Die Suche ist vorübergehend nicht erreichbar.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
