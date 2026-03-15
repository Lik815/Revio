import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SearchInput, SearchTherapist, SearchPractice } from '@revio/shared';
import { normalizeText, bestScore, scoreMatch } from '../utils/search-utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const GENERIC_QUERIES = new Set([
  'physiotherapie', 'physio', 'therapeut', 'physiotherapeut', 'krankengymnastik',
]);

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

// ── Relevance scoring ──────────────────────────────────────────────────────

/**
 * Score a therapist against a normalized query string.
 *
 * Priority (highest → lowest):
 *  10  exact therapist name match
 *   9  prefix match on therapist name
 *   8  exact practice name match
 *   7  prefix match on practice name
 *   6  exact specialization match
 *   5  partial specialization match
 *   4  word-level specialization match
 *   3  certification match
 *   2  bio / name contains query
 *   1  generic query (all therapists)
 * 0.5  base score for approved therapists
 */
function scoreTherapist(
  t: {
    specializations: string;
    certifications: string;
    bio: string | null;
    fullName: string;
  },
  query: string,
  practiceNames: string[],
): number {
  const q = normalizeText(query);
  const name = normalizeText(t.fullName);
  const specs = splitList(t.specializations).map(normalizeText);
  const certs = splitList(t.certifications).map(normalizeText);
  const bio = normalizeText(t.bio ?? '');
  const practices = practiceNames.map(normalizeText);

  // Therapist name
  const nameScore = scoreMatch(name, q);
  if (nameScore >= 9) return 10;   // exact
  if (nameScore >= 6) return 9;    // prefix word
  if (nameScore >= 4) return 8.5;  // substring

  // Practice name
  const practiceScore = bestScore(practices, q);
  if (practiceScore >= 9) return 8;
  if (practiceScore >= 6) return 7;
  if (practiceScore >= 4) return 6.5;

  // Exact specialization match
  if (specs.some((s) => s === q)) return 6;

  // Partial specialization (e.g., "rücken" ↔ "rückenschmerzen")
  if (specs.some((s) => s.includes(q) || q.includes(s))) return 5;

  // Word-level specialization (compound terms)
  const wordsQ = q.split(/\s+/);
  if (specs.some((s) => wordsQ.some((w) => s.includes(w) || w.includes(s)))) return 4;

  // Certification match
  if (certs.some((c) => c.includes(q) || q.includes(c))) return 3;

  // Bio or name contains query
  if (bio.includes(q) || name.includes(q)) return 2;

  // Generic query → everyone qualifies
  if (GENERIC_QUERIES.has(q)) return 1;

  return 0.5;
}

// ── Routes ─────────────────────────────────────────────────────────────────

const searchBodySchema = z.object({
  query: z.string().min(1),
  city: z.string().min(1),
  language: z.string().optional(),
  homeVisit: z.boolean().optional(),
  specialization: z.string().optional(),
  kassenart: z.string().optional(),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /search ─────────────────────────────────────────────────────────

  fastify.post('/search', async (request, reply) => {
    const parsed = searchBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.flatten().toString());

    const input: SearchInput = parsed.data;

    // Load all approved therapists — always visible, practices are optional
    const therapists = await fastify.prisma.therapist.findMany({
      where: { reviewStatus: 'APPROVED' },
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

    const results: SearchTherapist[] = therapists
      .filter((t) => {
        // City: case-insensitive exact match (required — therapists are local)
        if (t.city.toLowerCase() !== input.city.toLowerCase()) return false;

        const languages = splitList(t.languages).map((l) => l.toLowerCase());
        const specializations = splitList(t.specializations).map((s) => s.toLowerCase());

        if (input.language && !languages.includes(input.language.toLowerCase())) return false;
        if (typeof input.homeVisit === 'boolean' && t.homeVisit !== input.homeVisit) return false;
        if (input.specialization && !specializations.includes(input.specialization.toLowerCase())) return false;
        if (input.kassenart && (t as any).kassenart && (t as any).kassenart !== input.kassenart) return false;

        return true;
      })
      .map((t) => {
        const practiceNames = t.links.map((l) => l.practice.name);
        const relevance = scoreTherapist(t, input.query, practiceNames);
        const specializations = splitList(t.specializations);

        const practices: SearchPractice[] = t.links.map((link) => {
          let photos: string[] | undefined;
          if (link.practice.photos) {
            try { photos = JSON.parse(link.practice.photos); } catch {}
          }
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
            logo: link.practice.logo ?? undefined,
            photos,
          };
        });

        return {
          id: t.id,
          fullName: t.fullName,
          professionalTitle: t.professionalTitle,
          specializations,
          languages: splitList(t.languages),
          certifications: splitList(t.certifications),
          kassenart: (t as any).kassenart ?? '',
          homeVisit: t.homeVisit,
          city: t.city,
          bio: t.bio ?? undefined,
          photo: t.photo ?? undefined,
          relevance,
          practices,
        };
      })
      .sort((a, b) => b.relevance - a.relevance);

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
        specializations: splitList(t.specializations),
        languages: splitList(t.languages),
        certifications: splitList(t.certifications),
        homeVisit: t.homeVisit, city: t.city, bio: t.bio ?? undefined,
        photo: t.photo ?? undefined, practices,
      },
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
};
