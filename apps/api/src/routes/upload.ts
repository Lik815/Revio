import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { getToken } from './auth-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads');

// Ensure uploads directory exists
mkdirSync(UPLOADS_DIR, { recursive: true });

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /upload/photo
   * Accepts multipart/form-data with a single "photo" file field.
   * Saves the file to disk (swap this block for S3 putObject in production).
   * Returns { url: "/uploads/<uuid>.jpg" }
   */
  fastify.post('/upload/photo', async (request, reply) => {
    const token = getToken(request);
    if (!token) return reply.unauthorized('Kein Token');

    const therapist = await fastify.prisma.therapist.findUnique({
      where: { sessionToken: token },
    });
    if (!therapist) return reply.unauthorized('Ungültiger Token');

    const data = await (request as any).file();
    if (!data) return reply.badRequest('Keine Datei übermittelt');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.badRequest('Nur JPEG, PNG und WebP sind erlaubt');
    }

    const ext = data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${randomBytes(16).toString('hex')}.${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    // ── In production: replace this with S3 putObject ──────────────────────
    await pipeline(data.file, createWriteStream(filepath));
    // ───────────────────────────────────────────────────────────────────────

    const url = `/uploads/${filename}`;

    // Persist URL to therapist profile
    await fastify.prisma.therapist.update({
      where: { id: therapist.id },
      data: { photo: url },
    });

    return { url };
  });
};
