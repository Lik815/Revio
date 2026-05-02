/**
 * Geocoding via Nominatim (OpenStreetMap) — no API key required.
 *
 * Rate limit: max 1 req/second per Nominatim usage policy.
 * For production with high volume, replace with Google Geocoding API:
 *   POST https://maps.googleapis.com/maps/api/geocode/json?address=...&key=GOOGLE_API_KEY
 */

interface GeoResult {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string, city: string): Promise<GeoResult | null> {
  const query = [address, city].filter(Boolean).join(', ');
  if (!query.trim()) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de,at,ch`;

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a User-Agent identifying your app
        'User-Agent': 'Revio/1.0 (contact@revio.de)',
        'Accept-Language': 'de',
      },
    });
    if (!res.ok) return null;

    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    // Geocoding is best-effort — don't fail the whole request if it errors
    return null;
  }
}
