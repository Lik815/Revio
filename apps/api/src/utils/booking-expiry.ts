import { FastifyInstance } from 'fastify';

// Throttle: collapse rapid back-to-back expiry scans (e.g. several booking-list
// GETs firing within milliseconds on the same therapist) into one scan.
const EXPIRY_THROTTLE_MS = 30_000;
const lastRunAt = new Map<string, number>();

function throttleKey(where: Record<string, unknown>): string {
  if (typeof where.therapistId === 'string') return `therapist:${where.therapistId}`;
  if (typeof where.patientUserId === 'string') return `patient:${where.patientUserId}`;
  return 'global';
}

// Setzt abgelaufene PENDING-Buchungen auf EXPIRED. Im dynamischen Buchungssystem
// wird kein TherapistSlot-Status mehr zurückgesetzt — der Zeitraum wird
// automatisch frei, sobald der Booking-Status PENDING|CONFIRMED verlässt.
export async function expireStaleBookings(fastify: FastifyInstance, where: Record<string, unknown> = {}) {
  const key = throttleKey(where);
  const last = lastRunAt.get(key);
  if (last !== undefined && Date.now() - last < EXPIRY_THROTTLE_MS) return;
  lastRunAt.set(key, Date.now());

  // Ein einziger Roundtrip: updateMany mit 0 Treffern ist billiger als der
  // frühere findMany-Vorab-Check + updateMany (Latenz API↔DB dominiert).
  await fastify.prisma.bookingRequest.updateMany({
    where: { ...where, status: 'PENDING', responseDueAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
}
