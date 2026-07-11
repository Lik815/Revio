import type { FastifyReply, FastifyRequest } from 'fastify';
import { getBooleanAppSetting, COURSES_ENABLED_KEY } from './app-settings.js';

// Kurz gecachter Lesezugriff, damit nicht jeder Kurs-Request einen DB-Treffer
// auf AppSetting erzeugt. Der Admin-Toggle invalidiert den Cache sofort
// (invalidateCoursesEnabledCache), sodass das Abschalten ohne Verzögerung greift.
const TTL_MS = 30_000;
let cache: { value: boolean; at: number } | null = null;

type PrismaLike = Parameters<typeof getBooleanAppSetting>[0];

export async function areCoursesEnabled(prisma: PrismaLike): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const value = await getBooleanAppSetting(prisma, COURSES_ENABLED_KEY, true);
  cache = { value, at: now };
  return value;
}

export function invalidateCoursesEnabledCache(): void {
  cache = null;
}

// onRequest-Hook für die öffentlichen + Provider-Kursrouten. Ist das Feature
// plattformweit deaktiviert, existiert der Endpunkt für Clients faktisch nicht
// mehr (404) — auch für direkte API-Aufrufe und gecachte Deep-Links.
// Die Admin-Kursrouten werden bewusst NICHT gegated, damit bestehende Kurse
// nach dem Abschalten weiter eingesehen und aufgeräumt werden können.
export async function courseFeatureGate(request: FastifyRequest, reply: FastifyReply) {
  const enabled = await areCoursesEnabled(request.server.prisma);
  if (!enabled) {
    return reply.status(404).send({ error: 'Funktion nicht verfügbar' });
  }
}
