import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export default fp(async (fastify) => {
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
