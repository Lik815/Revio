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

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/search', async (request, reply) => {
    const parsed = searchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.flatten().toString());
    }

    const input: SearchInput = parsed.data;

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

        return true;
      })
      .map((t) => {
        const specializations = splitList(t.specializations);
        const relevance = specializations.some((s) =>
          s.toLowerCase().includes(input.query.toLowerCase())
        ) ? 1 : 0;

        const practices: SearchPractice[] = t.links.map((link) => ({
          id: link.practice.id,
          name: link.practice.name,
          city: link.practice.city,
          lat: link.practice.lat,
          lng: link.practice.lng,
        }));

        return {
          id: t.id,
          fullName: t.fullName,
          professionalTitle: t.professionalTitle,
          specializations,
          languages: splitList(t.languages),
          homeVisit: t.homeVisit,
          city: t.city,
          bio: t.bio ?? undefined,
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
