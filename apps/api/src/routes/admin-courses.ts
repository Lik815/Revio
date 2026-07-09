import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';
import { assertEligibleConsistency } from '../utils/course-assertions.js';

const reviewSchema = z.object({
  status: z.enum([
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
    ReviewStatus.CHANGES_REQUESTED,
    ReviewStatus.SUSPENDED,
  ]),
  adminNote: z.string().optional(),
});

const eligibilitySchema = z.object({
  healthInsuranceEligible: z.boolean(),
  zppVerified: z.boolean(),
  zppDocUrl: z.string().url().optional().nullable(),
});

export async function adminCourseRoutes(fastify: FastifyInstance) {

  // ── Pending Review Queue ───────────────────────────────────────────────────

  fastify.get('/admin/courses', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const query = (request.query as any);
    const status = query.status as ReviewStatus | undefined;
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10)));

    const where = status ? { reviewStatus: status } : {};

    const [courses, total] = await Promise.all([
      fastify.prisma.course.findMany({
        where,
        include: {
          category: { select: { key: true, label: true } },
          therapist: { select: { id: true, fullName: true, email: true, city: true } },
          practice: { select: { id: true, name: true, city: true } },
          runs: { select: { id: true, status: true }, take: 5 },
        },
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      fastify.prisma.course.count({ where }),
    ]);

    return reply.send({ courses, total, page, limit });
  });

  fastify.get('/admin/courses/:id', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const course = await fastify.prisma.course.findUnique({
      where: { id },
      include: {
        category: true,
        therapist: { select: { id: true, fullName: true, email: true, city: true } },
        practice: { select: { id: true, name: true, city: true } },
        runs: {
          include: {
            sessions: { orderBy: { startsAt: 'asc' } },
            _count: { select: { enrollments: true } },
          },
        },
      },
    });
    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });
    return reply.send(course);
  });

  // ── Review action ──────────────────────────────────────────────────────────

  fastify.patch('/admin/courses/:id/review', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    const existing = await fastify.prisma.course.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const { status, adminNote } = parsed.data;

    const updated = await fastify.prisma.course.update({
      where: { id },
      data: { reviewStatus: status, adminNote: adminNote ?? null },
    });
    return reply.send(updated);
  });

  // ── Health-insurance eligibility (admin-exclusive write) ───────────────────

  fastify.patch('/admin/courses/:id/eligibility', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = eligibilitySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Daten', details: parsed.error.flatten() });

    assertEligibleConsistency({
      healthInsuranceEligible: parsed.data.healthInsuranceEligible,
      zppVerified: parsed.data.zppVerified,
    });

    const existing = await fastify.prisma.course.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    const updated = await fastify.prisma.course.update({
      where: { id },
      data: {
        healthInsuranceEligible: parsed.data.healthInsuranceEligible,
        zppVerified: parsed.data.zppVerified,
        zppDocUrl: parsed.data.zppDocUrl ?? null,
      },
    });
    return reply.send(updated);
  });

  // ── Enrollment overview (admin) ────────────────────────────────────────────

  fastify.get('/admin/courses/:courseId/runs/:runId/enrollments', {
    preHandler: fastify.verifyAdmin,
  }, async (request, reply) => {
    const { courseId, runId } = request.params as { courseId: string; runId: string };
    const run = await fastify.prisma.courseRun.findFirst({ where: { id: runId, courseId } });
    if (!run) return reply.status(404).send({ error: 'Durchlauf nicht gefunden' });

    const enrollments = await fastify.prisma.courseEnrollment.findMany({
      where: { courseRunId: runId },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(enrollments);
  });
}
