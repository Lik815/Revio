import { FastifyInstance } from 'fastify';
import { z } from 'zod';

type FeedbackActor = {
  userId: string | null;
  email: string;
  isAuthenticated: boolean;
};

function getBearerToken(header?: string) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

async function resolveFeedbackActor(fastify: FastifyInstance, token: string | null): Promise<FeedbackActor | null> {
  if (!token) return null;

  const user = await fastify.prisma.user.findUnique({
    where: { sessionToken: token },
    select: { id: true, email: true },
  });
  if (user) return { userId: user.id, email: user.email, isAuthenticated: true };

  const therapist = await fastify.prisma.therapist.findUnique({
    where: { sessionToken: token },
    select: { email: true },
  });
  if (therapist) return { userId: null, email: therapist.email, isAuthenticated: true };

  return null;
}

function mapFeedback(feedback: {
  id: string;
  userId: string | null;
  email: string;
  message: string;
  status: 'NEW' | 'RESOLVED';
  isAuthenticated: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: feedback.id,
    userId: feedback.userId,
    email: feedback.email,
    message: feedback.message,
    status: feedback.status,
    isAuthenticated: feedback.isAuthenticated,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
  };
}

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post('/feedback', async (request, reply) => {
    const actor = await resolveFeedbackActor(
      fastify,
      getBearerToken(request.headers.authorization),
    );

    const schema = actor
      ? z.object({
          email: z.string().trim().email().optional(),
          message: z.string().trim().min(1).max(5000),
        })
      : z.object({
          email: z.string().trim().email(),
          message: z.string().trim().min(1).max(5000),
        });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: parsed.error.flatten(),
      });
    }

    const resolvedEmail = actor?.email
      ?? (typeof parsed.data.email === 'string' ? parsed.data.email.trim() : '');

    const feedback = await fastify.prisma.appFeedback.create({
      data: {
        userId: actor?.userId ?? null,
        email: resolvedEmail,
        message: parsed.data.message.trim(),
        isAuthenticated: !!actor,
      },
    });

    return reply.status(201).send({
      feedback: mapFeedback(feedback),
    });
  });
}
