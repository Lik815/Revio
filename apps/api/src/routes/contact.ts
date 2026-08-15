import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendContactMessageEmail } from '../utils/mailer.js';

// Rollen bewusst als geschlossene Liste: Freitext an dieser Stelle würde
// ungeprüft in den Betreff der Benachrichtigungsmail wandern.
const ROLES = ['Physio finden', 'Therapeut:in', 'Allgemeine Frage'] as const;

const contactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200),
  role: z.enum(ROLES),
  message: z.string().trim().min(1).max(5000),
  // Honeypot: echte Nutzer:innen füllen das Feld nie aus, Bots meistens schon.
  website: z.string().max(0).optional(),
});

export async function contactRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/contact',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const parsed = contactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parsed.error.flatten(),
        });
      }

      // Honeypot gefüllt: still verwerfen, damit Bots kein Signal bekommen.
      if (parsed.data.website) {
        return reply.status(202).send({ ok: true });
      }

      const inbox = process.env.CONTACT_INBOX_EMAIL?.trim();
      if (!inbox) {
        // Fehlkonfiguration ist ein Serverproblem, kein Nutzerfehler — der
        // Grund gehört ins Log, aber nicht in die Antwort.
        fastify.log.error('CONTACT_INBOX_EMAIL is not set — contact form cannot deliver');
        return reply.status(503).send({ error: 'Contact channel unavailable' });
      }

      try {
        await sendContactMessageEmail({
          to: inbox,
          fromName: parsed.data.name || 'Ohne Namen',
          fromEmail: parsed.data.email,
          role: parsed.data.role,
          message: parsed.data.message,
        });
      } catch (error) {
        // DS-60/61: nur den Fehler loggen, keine Inhalte und keine Adresse.
        fastify.log.error(
          { err: error instanceof Error ? error.message : 'unknown' },
          'contact form delivery failed',
        );
        return reply.status(502).send({ error: 'Delivery failed' });
      }

      // Die Nachricht wird ausschließlich zugestellt, nicht gespeichert
      // (DS-21/22 Datenminimierung) — deshalb gibt es nichts zurückzugeben.
      return reply.status(202).send({ ok: true });
    },
  );
}
