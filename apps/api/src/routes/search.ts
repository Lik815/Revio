import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { SearchInput, SearchTherapist, SearchPractice } from '@revio/shared';

const searchBodySchema = z.object({
  query: z.string().min(1),
  city: z.string().min(1),
  language: z.string().optional(),
  homeVisit: z.boolean().optional(),
  specialization: z.string().optional(),
});

const splitList = (value: string) =>
  value.split(',').map((s) => s.trim()).filter(Boolean);

const norm = (s: string) => s.toLowerCase().trim();

const GENERIC_QUERIES = new Set(['physiotherapie', 'physio', 'therapeut', 'physiotherapeut', 'krankengymnastik']);

// Word-level match helper: splits compound terms and checks overlap
const wordsMatch = (a: string, b: string): boolean => {
  const wordsA = a.replace(/[-–]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.replace(/[-–]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  return wordsA.some(wa => wordsB.some(wb => wa.includes(wb) || wb.includes(wa)));
};

// Returns relevance score for ranking
const scoreTherapist = (
  t: { specializations: string; certifications: string; bio: string | null; fullName: string },
  query: string,
): number => {
  const q = norm(query);
  const specs = splitList(t.specializations).map(norm);
  const certs = splitList(t.certifications).map(norm);
  const bio = norm(t.bio ?? '');
  const name = norm(t.fullName);

  // Perfect match in specializations
  if (specs.some((s) => s === q)) return 5;
  
  // Partial match in specializations (e.g., "rücken" matches "rückenschmerzen")
  if (specs.some((s) => s.includes(q) || q.includes(s))) return 4;
  
  // Word-level match (e.g., "schulter" matches "schulterrehabilitation")
  if (specs.some((s) => wordsMatch(s, q))) return 3.5;
  
  // Match in certifications
  if (certs.some((c) => c.includes(q) || q.includes(c))) return 3;
  
  // Match in bio or name
  if (bio.includes(q) || name.includes(q)) return 2;
  
  // Generic match for broad queries - everyone gets some relevance
  if (GENERIC_QUERIES.has(q)) return 1;
  
  // Even for specific queries, give a base score for approved therapists
  return 0.5;
};

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/search', async (request, reply) => {
    const parsed = searchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.flatten().toString());
    }

    const input: SearchInput = parsed.data;
    const isGenericQuery = GENERIC_QUERIES.has(norm(input.query));

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
        if (t.city.toLowerCase() !== input.city.toLowerCase()) return false;

        const languages = splitList(t.languages).map((l) => l.toLowerCase());
        const specializations = splitList(t.specializations).map((s) => s.toLowerCase());

        if (input.language && !languages.includes(input.language.toLowerCase())) return false;
        if (typeof input.homeVisit === 'boolean' && t.homeVisit !== input.homeVisit) return false;
        if (input.specialization && !specializations.includes(input.specialization.toLowerCase())) return false;

        // Now we include all therapists and let relevance do the ranking
        return true;
      })
      .map((t) => {
        const specializations = splitList(t.specializations);
        const relevance = scoreTherapist(t, input.query);

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
      meta: { note: 'MVP ranking: approved-only, deterministic relevance.' },
    };
  });
};
