import { FastifyPluginAsync } from 'fastify';
import { ensureDefaultCertificationOptions } from '../utils/certification-options.js';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/config/options', async () => {
    await ensureDefaultCertificationOptions(fastify.prisma);

    const certifications = await fastify.prisma.certificationOption.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return {
      certifications: certifications.map((option) => ({
        key: option.key,
        label: option.label,
      })),
    };
  });
};
