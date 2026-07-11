import { FastifyInstance } from 'fastify';
import { ReviewStatus, CourseRunStatus, CourseLocationType } from '@prisma/client';

export async function publicCourseRoutes(fastify: FastifyInstance) {

  // ── Kurssuche ──────────────────────────────────────────────────────────────
  // GET /courses?q=yoga&categoryKey=bewegung&city=Berlin&locationType=ONSITE&page=1&limit=20

  fastify.get('/courses', async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10)));

    const where: any = {
      reviewStatus: ReviewStatus.APPROVED,
      ...(q.categoryKey ? { categoryKey: q.categoryKey } : {}),
      ...(q.locationType ? { locationType: q.locationType as CourseLocationType } : {}),
      ...(q.q ? { title: { contains: q.q } } : {}),
      runs: {
        some: {
          status: CourseRunStatus.PUBLISHED,
          ...(q.city ? { city: { contains: q.city } } : {}),
        },
      },
    };

    const [courses, total] = await Promise.all([
      fastify.prisma.course.findMany({
        where,
        include: {
          category: { select: { key: true, label: true } },
          therapist: { select: { id: true, fullName: true, city: true, photo: true } },
          practice: { select: { id: true, name: true, city: true, logo: true } },
          runs: {
            where: { status: CourseRunStatus.PUBLISHED },
            include: {
              sessions: { orderBy: { startsAt: 'asc' }, take: 1 },
              _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      fastify.prisma.course.count({ where }),
    ]);

    // Kurse mit ausgebuchten Runs nach hinten schieben
    const sorted = [...courses].sort((a, b) => {
      const aFull = a.runs.every(r => r._count.enrollments >= r.maxParticipants);
      const bFull = b.runs.every(r => r._count.enrollments >= r.maxParticipants);
      if (aFull && !bFull) return 1;
      if (!aFull && bFull) return -1;
      return 0;
    });

    return reply.send({
      courses: sorted.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description.slice(0, 200),
        locationType: c.locationType,
        healthInsuranceEligible: c.healthInsuranceEligible,
        zppVerified: c.zppVerified,
        category: c.category,
        provider: c.therapist
          ? { type: 'therapist', id: c.therapist.id, name: c.therapist.fullName, city: c.therapist.city, photo: c.therapist.photo }
          : c.practice
          ? { type: 'practice', id: c.practice.id, name: c.practice.name, city: c.practice.city, photo: c.practice.logo }
          : null,
        runs: c.runs.map(r => ({
          id: r.id,
          label: r.label,
          status: r.status,
          city: r.city,
          maxParticipants: r.maxParticipants,
          confirmedCount: r._count.enrollments,
          available: r._count.enrollments < r.maxParticipants,
          waitlistEnabled: r.waitlistEnabled,
          bookingDeadline: r.bookingDeadline,
          priceAmount: r.priceAmount,
          priceCurrency: r.priceCurrency,
          nextSessionAt: r.sessions[0]?.startsAt ?? null,
        })),
      })),
      total,
      page,
      limit,
    });
  });

  // ── Kursdetail ─────────────────────────────────────────────────────────────
  // GET /courses/:id

  fastify.get('/courses/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const course = await fastify.prisma.course.findFirst({
      where: { id, reviewStatus: ReviewStatus.APPROVED },
      include: {
        category: true,
        therapist: { select: { id: true, fullName: true, bio: true, city: true, photo: true, specializations: true } },
        practice: { select: { id: true, name: true, description: true, city: true, address: true, phone: true, logo: true } },
        runs: {
          where: { status: { in: [CourseRunStatus.PUBLISHED, CourseRunStatus.PAUSED] } },
          include: {
            sessions: { orderBy: { startsAt: 'asc' } },
            _count: { select: { enrollments: { where: { status: 'CONFIRMED' } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!course) return reply.status(404).send({ error: 'Kurs nicht gefunden' });

    return reply.send({
      id: course.id,
      title: course.title,
      description: course.description,
      targetAudience: course.targetAudience,
      prerequisites: course.prerequisites,
      instructorName: course.instructorName,
      instructorBio: course.instructorBio,
      contactInfo: course.contactInfo,
      cancellationPolicy: course.cancellationPolicy,
      locationType: course.locationType,
      healthInsuranceEligible: course.healthInsuranceEligible,
      zppVerified: course.zppVerified,
      category: course.category,
      provider: course.therapist
        ? { type: 'therapist', ...course.therapist }
        : course.practice
        ? { type: 'practice', ...course.practice }
        : null,
      runs: course.runs.map(r => ({
        id: r.id,
        label: r.label,
        status: r.status,
        address: r.address,
        city: r.city,
        onlineUrl: r.onlineUrl,
        maxParticipants: r.maxParticipants,
        minParticipants: r.minParticipants,
        confirmedCount: r._count.enrollments,
        available: r._count.enrollments < r.maxParticipants,
        waitlistEnabled: r.waitlistEnabled,
        waitlistMax: r.waitlistMax,
        bookingDeadline: r.bookingDeadline,
        priceAmount: r.priceAmount,
        priceCurrency: r.priceCurrency,
        sessions: r.sessions.map(s => ({
          id: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          location: s.location,
        })),
      })),
    });
  });
}
