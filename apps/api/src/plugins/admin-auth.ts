import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest } from 'fastify';
import { getEnv } from '../env.js';

function getBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export default fp(async (fastify) => {
  const env = getEnv();

  fastify.decorate('verifyAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getBearerToken(request);
    if (!token || token !== env.REVIO_ADMIN_TOKEN) {
      return reply.unauthorized('Unauthorized');
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    verifyAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | void>;
  }
}
