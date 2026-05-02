import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SearchInput, SearchTherapist, SearchPractice } from '@revio/shared';
import { normalizeText, scoreMatch, levenshtein } from '../utils/search-utils.js';
import { getTherapistPublicationState } from '../utils/profile-completeness.js';

// ── Constants ──────────────────────────────────────────────────────────────

const GENERIC_QUERIES = new Set([
  'physiotherapie', 'physio', 'therapeut', 'physiotherapeut', 'krankengymnastik',
]);

const MOBILE_QUERY_TERMS = ['mobile', 'mobil', 'hausbesuch'];
const PHYSIO_QUERY_TERMS = [
  'physio',
  'physiotherapie',
  'physiotherapeut',
  'physiotherapeutin',
  'krankengymnastik',
];

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

function isMobilePhysioQuery(value: string): boolean {
  const normalized = normalizeText(value);
  const words = normalized.split(/\s+/).filter(Boolean);

  const hasMobileIntent = MOBILE_QUERY_TERMS.some((term) =>
    words.includes(term) || normalized.includes(term),
  );
  const hasPhysioIntent = PHYSIO_QUERY_TERMS.some((term) =>
    words.includes(term) || normalized.includes(term),
  );

  return hasMobileIntent && hasPhysioIntent;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Relevance scoring ──────────────────────────────────────────────────────

/**
 * Score a therapist against a normalized query string.
 *
 * Priority (highest → lowest):
 *  12  exact therapist name match
 *  11  multi-word therapist name match
 *  10  exact specialization match           + homeVisit boost
 *   8  partial specialization match         + homeVisit boost
 *   6  word-level specialization match      + homeVisit boost
 *   5  certification match                  + homeVisit boost
 *   4  bio contains query                   + homeVisit boost
 *   4  strong single-token therapist name match
 *   3  loose therapist name match
 *   9  mobile physio intent + standalone mobile therapist
 *   6  mobile physio intent + mobile therapist with practice
 *   1  generic query (all home-visit therapists first)
 *   0  no match
 *
 * homeVisit boost: ×1.4 wenn Patient nach homeVisit filtert, ×1.2 sonst
 */
function scoreNameQuery(fullName: string, query: string): number {
  const normalizedName = normalizeText(fullName);
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const nameWords = normalizedName.split(/\s+/).filter(Boolean);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  if (normalizedName === normalizedQuery) return 12;

  if (queryWords.length > 1) {
    const exactAllWords = queryWords.every((queryWord) =>
      nameWords.some((nameWord) => nameWord === queryWord),
    );
    if (exactAllWords) return 11;

    const prefixAllWords = queryWords.every((queryWord) =>
      nameWords.some((nameWord) => nameWord.startsWith(queryWord)),
    );
    if (prefixAllWords) return 10;

    const fuzzyAllWords = queryWords.every((queryWord) =>
      nameWords.some((nameWord) => nameWord.includes(queryWord) || queryWord.includes(nameWord)),
    );
    if (fuzzyAllWords) return 8;
  }

  const singleScore = scoreMatch(normalizedName, normalizedQuery);
  if (singleScore >= 9) return 9;
  if (singleScore >= 6) return 7;
  if (singleScore >= 3) return 5;
  return 0;
}

function scoreTherapist(
  t: {
    specializations: string;
    certifications: string;
    bio: string | null;
    fullName: string;
    homeVisit: boolean;
  },
  query: string,
  practiceNames: string[],
  homeVisitFilter?: boolean,
): number {
  const q = normalizeText(query);
  const specs = splitList(t.specializations).map(normalizeText);
  const certs = splitList(t.certifications).map(normalizeText);
  const bio = normalizeText(t.bio ?? '');
  const nameScore = scoreNameQuery(t.fullName, query);

  const boost = (base: number) => {
    if (t.homeVisit && homeVisitFilter === true) return base * 1.4;
    if (t.homeVisit) return base * 1.2;
    return base;
  };

  // Starke Namenssuche zuerst, damit "Anna Becker" oder "Becker An"
  // zuverlässig zum Profil führen.
  if (nameScore >= 10) return nameScore;

  // Problem-match zuerst (Patient sucht nach Beschwerden/Behandlung)
  if (specs.some((s) => s === q)) return boost(10);
  if (specs.some((s) => s.includes(q) || q.includes(s))) return boost(8);
  const wordsQ = q.split(/\s+/);
  if (specs.some((s) => wordsQ.some((w) => s.includes(w) || w.includes(s)))) return boost(6);
  if (certs.some((c) => c.includes(q) || q.includes(c))) return boost(5);
  if (bio.includes(q)) return boost(4);

  // Name-Match sekundär (Patienten suchen nach Problem, nicht nach Name)
  if (nameScore >= 9) return 4;
  if (nameScore >= 5) return 3;

  // "mobile physio" soll mobile, eigenständige Therapeut:innen sichtbar machen,
  // auch wenn der Begriff nicht als Spezialisierung gepflegt wurde.
  if (isMobilePhysioQuery(q)) {
    if (t.homeVisit && practiceNames.length === 0) return boost(9);
    if (t.homeVisit) return boost(6);
  }

  // Generischer Begriff
  if (GENERIC_QUERIES.has(q)) return boost(1);

  // Fuzzy fallback: typo-tolerant matching against specializations
  if (q.length >= 5) {
    const maxDist = q.length >= 8 ? 2 : 1;
    if (specs.some((s) => levenshtein(s, q) <= maxDist || s.split(/\s+/).some((w) => w.length >= 4 && levenshtein(w, q) <= maxDist))) {
      return boost(3);
    }
    if (certs.some((c) => levenshtein(c, q) <= maxDist || c.split(/\s+/).some((w) => w.length >= 4 && levenshtein(w, q) <= maxDist))) {
      return boost(2);
    }
  }

  return 0;
}

// ── Routes ─────────────────────────────────────────────────────────────────

const searchBodySchema = z.object({
  query: z.string().min(1),
  city: z.string().trim().min(1).optional(),
  origin: z.object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  }).optional(),
  radiusKm: z.number().positive().max(100).optional(),
  language: z.string().optional(),
  homeVisit: z.boolean().optional(),
  specialization: z.string().optional(),
  kassenart: z.string().optional(),
}).refine((data) => Boolean(data.city) || Boolean(data.origin), {
  message: 'city oder origin ist erforderlich',
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /search ─────────────────────────────────────────────────────────

  fastify.post('/search', async (request, reply) => {
    const parsed = searchBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const input: SearchInput = parsed.data;
    fastify.log.info({ searchInput: input }, 'mobile search input');

    // Load all approved therapists that are publicly visible.
    // Invited profiles and manager-onboarding profiles require an explicit publication
    // confirmation before they may appear in search.
    const therapists = await fastify.prisma.therapist.findMany({
      where: {
        reviewStatus: 'APPROVED',
        isVisible: true,
        OR: [
          {
            invitedByPracticeId: null,
            onboardingStatus: { not: 'manager_onboarding' },
          },
          { isPublished: true },
        ],
      },
      include: {
        links: {
          where: {
            status: 'CONFIRMED',
            practice: { reviewStatus: 'APPROVED' },
          },
          include: { practice: true },
        },
      },
    });

    const normalizedCity = input.city ? normalizeText(input.city) : null;
    const passesFilters = (t: typeof therapists[number], { requireCityMatch }: { requireCityMatch: boolean }) => {
      if (requireCityMatch && normalizedCity && normalizeText(t.city) !== normalizedCity) return false;

      const languages = splitList(t.languages).map((l) => l.toLowerCase());
      const specializations = splitList(t.specializations).map((s) => s.toLowerCase());

      if (input.language && !languages.includes(input.language.toLowerCase())) return false;
      if (typeof input.homeVisit === 'boolean' && t.homeVisit !== input.homeVisit) return false;
      if (input.specialization && !specializations.includes(input.specialization.toLowerCase())) return false;
      if (input.kassenart && (t as any).kassenart && (t as any).kassenart !== input.kassenart) return false;

      return true;
    };

    const publicTherapists = therapists.filter((t) =>
      getTherapistPublicationState(t, { links: t.links }).publicSearchEligible,
    );
    const shouldRequireCityMatch = !input.origin && Boolean(normalizedCity);
    const cityMatchedTherapists = shouldRequireCityMatch
      ? publicTherapists.filter((t) => passesFilters(t, { requireCityMatch: true }))
      : publicTherapists.filter((t) => passesFilters(t, { requireCityMatch: false }));
    const filteredTherapists = cityMatchedTherapists.length > 0
      ? cityMatchedTherapists
      : publicTherapists.filter((t) => passesFilters(t, { requireCityMatch: false }));

    const results: SearchTherapist[] = [];

    filteredTherapists.forEach((t) => {
      const practiceNames = t.links.map((l) => l.practice.name);
      const relevance = scoreTherapist(t, input.query, practiceNames, input.homeVisit);
      const specializations = splitList(t.specializations);

      // Distanz für mobile Therapeuten ohne Praxis (homeLat/homeLng)
      const tAny = t as any;
      const therapistDistKm =
        input.origin && tAny.homeLat && tAny.homeLat !== 0
          ? haversine(input.origin.lat, input.origin.lng, tAny.homeLat, tAny.homeLng)
          : undefined;

      const practices: SearchPractice[] = t.links
        .map((link) => {
          let photos: string[] | undefined;
          if (link.practice.photos) {
            try { photos = JSON.parse(link.practice.photos); } catch {}
          }

          const distKm = input.origin && link.practice.lat !== 0 && link.practice.lng !== 0
            ? haversine(input.origin.lat, input.origin.lng, link.practice.lat, link.practice.lng)
            : undefined;

          return {
            id: link.practice.id,
            name: link.practice.name,
            city: link.practice.city,
            address: link.practice.address ?? undefined,
            phone: link.practice.phone ?? undefined,
            hours: link.practice.hours ?? undefined,
            description: link.practice.description ?? undefined,
            lat: link.practice.lat,
            lng: link.practice.lng,
            distKm,
            logo: link.practice.logo ?? undefined,
            photos,
          };
        })
        .filter((practice) => {
          if (!input.origin) return true;
          if (practice.distKm == null) return false;
          if (input.radiusKm == null) return true;
          return practice.distKm <= input.radiusKm;
        })
        .sort((a, b) => (a.distKm ?? Number.POSITIVE_INFINITY) - (b.distKm ?? Number.POSITIVE_INFINITY));

      // Kein In-Radius-Ergebnis: nur mobile Therapeuten dürfen ohne Praxis erscheinen
      if (practices.length === 0 && input.origin && input.radiusKm != null && !t.homeVisit) return;

      // Mobile Therapeuten ohne Praxis: Radius-Check gegen serviceRadiusKm
      if (practices.length === 0 && t.homeVisit) {
        const svcRadius = tAny.serviceRadiusKm as number | null;
        if (input.origin && therapistDistKm != null && svcRadius != null) {
          if (therapistDistKm > svcRadius) return; // Patient außerhalb Einzugsgebiet
        }
      }

      // Score 0 ausschließen (kein Match und kein generischer Begriff)
      if (relevance <= 0) return;

      const nearestPracticeDistance = practices[0]?.distKm;
      const effectiveDistKm = practices.length > 0 ? nearestPracticeDistance : therapistDistKm;

      results.push({
        id: t.id,
        fullName: t.fullName,
        professionalTitle: t.professionalTitle,
        isFreelancer: t.isFreelancer,
        specializations,
        languages: splitList(t.languages),
        certifications: splitList(t.certifications),
        kassenart: tAny.kassenart ?? '',
        availability: tAny.availability ?? '',
        homeVisit: t.homeVisit,
        city: t.city,
        bio: t.bio ?? undefined,
        photo: t.photo ?? undefined,
        relevance,
        distKm: effectiveDistKm,
        practices,
        // Neue Felder für mobile Therapeuten
        ...(tAny.serviceRadiusKm != null ? { serviceRadiusKm: tAny.serviceRadiusKm } : {}),
        ...(practices.length === 0 && t.homeVisit && tAny.homeLat && tAny.homeLat !== 0
          ? { homeLat: tAny.homeLat, homeLng: tAny.homeLng }
          : {}),
      } as SearchTherapist & { serviceRadiusKm?: number; homeLat?: number; homeLng?: number });
    });

    results.sort((a, b) => {
      if (input.origin) {
        const aDist = a.distKm ?? Number.POSITIVE_INFINITY;
        const bDist = b.distKm ?? Number.POSITIVE_INFINITY;
        if (aDist !== bDist) return aDist - bDist;
      }
      return b.relevance - a.relevance;
    });

    const practiceMap = new Map<string, SearchPractice>();
    results.forEach((t) => t.practices.forEach((p) => practiceMap.set(p.id, p)));

    return {
      therapists: results,
      practices: Array.from(practiceMap.values()),
    };
  });

  // ── GET /therapist/:id ────────────────────────────────────────────────────

  fastify.get('/therapist/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const t = await fastify.prisma.therapist.findUnique({
      where: { id },
      include: {
        links: {
          where: { status: 'CONFIRMED' },
          include: { practice: true },
        },
      },
    });
    if (!t) return reply.notFound('Therapeut nicht gefunden');
    const publication = getTherapistPublicationState(t, { links: t.links });
    if (!publication.publicSearchEligible) return reply.notFound('Therapeut nicht gefunden');
    const practices = t.links.map((link) => {
      let photos: string[] | undefined;
      if (link.practice.photos) { try { photos = JSON.parse(link.practice.photos); } catch {} }
      return {
        id: link.practice.id, name: link.practice.name, city: link.practice.city,
        address: link.practice.address ?? undefined, phone: link.practice.phone ?? undefined,
        hours: link.practice.hours ?? undefined, description: link.practice.description ?? undefined,
        lat: link.practice.lat, lng: link.practice.lng,
        logo: link.practice.logo ?? undefined, photos,
      };
    });
    return {
      therapist: {
        id: t.id, fullName: t.fullName, professionalTitle: t.professionalTitle,
        isFreelancer: t.isFreelancer,
        specializations: splitList(t.specializations),
        languages: splitList(t.languages),
        certifications: splitList(t.certifications),
        kassenart: (t as any).kassenart ?? '',
        availability: (t as any).availability ?? '',
        email: t.email,
        homeVisit: t.homeVisit, city: t.city, bio: t.bio ?? undefined,
        ...((t as any).serviceRadiusKm != null ? { serviceRadiusKm: (t as any).serviceRadiusKm } : {}),
        photo: t.photo ?? undefined, practices,
      },
    };
  });

  // ── GET /practice-detail/:id ─────────────────────────────────────────────

  fastify.get('/practice-detail/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const practice = await fastify.prisma.practice.findUnique({
      where: { id },
      include: {
        links: {
          where: {
            status: 'CONFIRMED',
            therapist: {
              reviewStatus: 'APPROVED',
              isVisible: true,
              OR: [
                {
                  invitedByPracticeId: null,
                  onboardingStatus: { not: 'manager_onboarding' },
                },
                { isPublished: true },
              ],
            },
          },
          include: {
            therapist: {
              select: {
                id: true, fullName: true, professionalTitle: true,
                photo: true, specializations: true, city: true,
                homeVisit: true, bio: true,
                languages: true,
                reviewStatus: true,
                isVisible: true,
                isPublished: true,
                onboardingStatus: true,
              },
            },
          },
        },
      },
    });
    if (!practice) return reply.notFound('Praxis nicht gefunden');
    let photos: string[] | undefined;
    if (practice.photos) { try { photos = JSON.parse(practice.photos); } catch {} }
    return {
      practice: {
        id: practice.id, name: practice.name, city: practice.city,
        address: practice.address ?? undefined, phone: practice.phone ?? undefined,
        hours: practice.hours ?? undefined, description: practice.description ?? undefined,
        lat: practice.lat, lng: practice.lng,
        logo: practice.logo ?? undefined, photos,
      },
      therapists: practice.links
        .filter((l) =>
          getTherapistPublicationState(l.therapist, {
            links: [{ status: l.status, practice: { reviewStatus: practice.reviewStatus } }],
          }).publicSearchEligible,
        )
        .map((l) => {
        return ({
        id: l.therapist.id,
        fullName: l.therapist.fullName,
        professionalTitle: l.therapist.professionalTitle,
        photo: l.therapist.photo ?? undefined,
        specializations: splitList(l.therapist.specializations),
        city: l.therapist.city,
        homeVisit: l.therapist.homeVisit,
        bio: l.therapist.bio ?? undefined,
      })}),
    };
  });

  // ── GET /suggest ──────────────────────────────────────────────────────────
  // Returns autosuggest grouped by type. Requires at least 3 characters.

  fastify.get('/suggest', async (request) => {
    const { q = '' } = request.query as { q?: string };
    const nq = normalizeText(q);

    if (nq.length < 3) return { suggestions: [] };

    const db = fastify.prisma as any;
    const rows: Array<{ id: string; text: string; normalized: string; type: string; entityId: string | null; weight: number }> =
      await db.searchSuggestion.findMany({
        where: { normalized: { contains: nq } },
        orderBy: { weight: 'desc' },
        take: 50,
      });

    // Score and rank
    const scored = rows
      .map((r) => ({ ...r, score: scoreMatch(r.normalized, nq) * r.weight }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    // Group: max 3 per type, 10 total
    type SuggestionGroup = { type: string; items: { text: string; entityId: string | null }[] };
    const groups = new Map<string, SuggestionGroup>();
    let total = 0;

    for (const row of scored) {
      if (total >= 10) break;
      if (!groups.has(row.type)) groups.set(row.type, { type: row.type, items: [] });
      const g = groups.get(row.type)!;
      if (g.items.length >= 3) continue;
      g.items.push({ text: row.text, entityId: row.entityId });
      total++;
    }

    return { suggestions: Array.from(groups.values()) };
  });

  // ── GET /practices/search?q=... ──────────────────────────────────────────
  // Used during registration to find an existing practice by name/city

  fastify.get('/practices/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 2) return { practices: [] };

    const term = q.trim().toLowerCase();
    const practices = await fastify.prisma.practice.findMany({
      where: {
        reviewStatus: 'APPROVED',
        OR: [
          { name: { contains: term } },
          { city: { contains: term } },
        ],
      },
      select: { id: true, name: true, city: true, address: true, phone: true },
      take: 10,
      orderBy: { name: 'asc' },
    });

    return { practices };
  });
};
