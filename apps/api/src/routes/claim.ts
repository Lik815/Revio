import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { hashPassword, getToken } from './auth-utils.js';
import { resetSearchCache } from './search.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage, gleiche Laufzeit wie auth.ts
const newTokenExpiry = () => new Date(Date.now() + TOKEN_TTL_MS);

// Directory-First-Refactor (R5) — Claim-Flow Stufe A.
//
// Bewusste Einschränkung: Practice hat kein E-Mail-Feld und es gibt keine
// SMS-Infrastruktur, daher lässt sich nicht automatisch verifizieren, dass die
// claimende Person wirklich zur Praxis gehört. Der Trade-off (mit dem Nutzer
// abgestimmt): die claimende Person bestätigt ihre EIGENE E-Mail über den
// bestehenden, bewährten OTP-Mechanismus (siehe /register/send-otp und
// /register/confirm-otp — bewusst wiederverwendet, nicht neu gebaut). Der
// Missbrauchsschutz ist keine automatische Prüfung, sondern Sichtbarkeit: jede
// Übernahme ist über GET /admin/practices (ownerId gesetzt) nachvollziehbar.
export const claimRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /claim/practice/:id — öffentlich, minimale Info für die Claim-Seite.
  fastify.get('/claim/practice/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const practice = await fastify.prisma.practice.findUnique({
      where: { id },
      select: { id: true, name: true, city: true, ownerId: true },
    });
    if (!practice) return reply.notFound('Praxis nicht gefunden.');
    return { id: practice.id, name: practice.name, city: practice.city, claimed: Boolean(practice.ownerId) };
  });

  const claimSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    agbAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
  });

  // POST /claim/practice/:id — Konto anlegen + Praxis übernehmen. Setzt einen
  // bestätigten OTP für die eingegebene E-Mail voraus (2h-Fenster, gleiches
  // Muster wie /register/therapist).
  fastify.post('/claim/practice/:id', {
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = claimSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(
        Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe',
      );
    }
    const email = parsed.data.email.trim().toLowerCase();

    const practice = await fastify.prisma.practice.findUnique({ where: { id } });
    if (!practice) return reply.notFound('Praxis nicht gefunden.');
    if (practice.ownerId) return reply.conflict('Diese Praxis wurde bereits übernommen.');

    const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.conflict('Diese E-Mail-Adresse wird bereits verwendet.');

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const confirmedOtp = await fastify.prisma.emailOtp.findFirst({
      where: { email, verifiedAt: { not: null, gte: twoHoursAgo } },
      orderBy: { verifiedAt: 'desc' },
    });
    if (!confirmedOtp) {
      return reply.badRequest('E-Mail-Adresse nicht bestätigt. Bitte fordere zuerst einen Code an.');
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const sessionToken = randomBytes(32).toString('hex');

    await (fastify.prisma as any).$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'practice_owner',
          emailVerifiedAt: confirmedOtp.verifiedAt,
          requiresEmailVerification: false,
          sessionToken,
          sessionTokenExpiresAt: newTokenExpiry(),
        },
      });
      await tx.practice.update({ where: { id }, data: { ownerId: user.id } });
      await tx.emailOtp.delete({ where: { id: confirmedOtp.id } });
    });

    fastify.log.info({ practiceId: id, email }, 'practice claimed');
    resetSearchCache();
    return reply.status(201).send({ token: sessionToken, practiceId: id });
  });

  // GET /claim/me — eingeloggter Praxis-Owner sieht seine eigene Praxis.
  fastify.get('/claim/me', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { ownedPractice: true },
    });
    if (!user || user.role !== 'practice_owner') return reply.unauthorized('Kein Zugriff.');
    if (user.sessionTokenExpiresAt && user.sessionTokenExpiresAt < new Date()) {
      return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    if (!user.ownedPractice) return reply.notFound('Keine Praxis verknüpft.');

    return { practice: user.ownedPractice };
  });

  const updateOwnedPracticeSchema = z.object({
    name: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    hours: z.string().trim().optional(),
    description: z.string().trim().optional(),
    homeVisit: z.boolean().optional(),
  });

  // POST /claim/me/update — Selbstverwaltung nach dem Claim (Teil der
  // Stufe-A-Abnahme: "ist bearbeitbar").
  fastify.post('/claim/me/update', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const user = await fastify.prisma.user.findUnique({
      where: { sessionToken: token },
      include: { ownedPractice: true },
    });
    if (!user || user.role !== 'practice_owner') return reply.unauthorized('Kein Zugriff.');
    if (user.sessionTokenExpiresAt && user.sessionTokenExpiresAt < new Date()) {
      return reply.unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    if (!user.ownedPractice) return reply.notFound('Keine Praxis verknüpft.');

    const parsed = updateOwnedPracticeSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      return reply.badRequest(
        Object.entries(msg).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') || 'Ungültige Eingabe',
      );
    }
    const data = parsed.data;

    const practice = await fastify.prisma.practice.update({
      where: { id: user.ownedPractice.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.hours !== undefined && { hours: data.hours }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.homeVisit !== undefined && { homeVisit: data.homeVisit }),
      },
    });

    resetSearchCache();
    return { practice };
  });
};
