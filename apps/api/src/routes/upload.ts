import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { getToken } from './auth-utils.js';
import { uploadFile } from '../utils/storage.js';
import { PROFILE_PHOTOS_DIR, THERAPIST_VERIFICATIONS_DIR } from '../utils/storage-paths.js';

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload/photo', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const data = await (request as any).file();
    if (!data) return reply.badRequest('Keine Datei übermittelt');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.badRequest('Nur JPEG, PNG und WebP sind erlaubt');
    }

    const ext = data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `${randomBytes(16).toString('hex')}.${ext}`;

    const url = await uploadFile({
      key,
      stream: data.file,
      mimetype: data.mimetype,
      localDir: PROFILE_PHOTOS_DIR,
      publicPrefix: '/uploads/profile-photos',
    });

    await fastify.prisma.therapist.update({ where: { id: therapist.id }, data: { photo: url } });

    return { url };
  });

  fastify.post('/upload/document', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await fastify.prisma.therapist.findUnique({ where: { sessionToken: token } });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const data = await (request as any).file();
    if (!data) return reply.badRequest('Keine Datei übermittelt');

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.badRequest('Nur PDF, JPEG, PNG und WebP sind erlaubt');
    }

    const extMap: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const ext = extMap[data.mimetype] ?? 'bin';
    const key = `${randomBytes(16).toString('hex')}.${ext}`;

    await uploadFile({
      key,
      stream: data.file,
      mimetype: data.mimetype,
      localDir: THERAPIST_VERIFICATIONS_DIR,
      publicPrefix: '/documents',
    });

    const doc = await fastify.prisma.therapistDocument.create({
      data: {
        therapistId: therapist.id,
        filename: key,
        originalName: data.filename ?? key,
        mimetype: data.mimetype,
      },
    });

    return { id: doc.id, originalName: doc.originalName };
  });
};
