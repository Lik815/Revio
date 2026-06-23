import { FastifyInstance } from 'fastify';

// Throttle: this previously ran a findMany (+ transaction, if anything was stale) on
// every single booking-list GET. Several of those GETs fire back-to-back when a tab
// opens (slots + incoming + patients), so the same therapist's stale bookings were
// being scanned multiple times within milliseconds. A short in-memory window collapses
// those into one scan; a few seconds of delay expiring a booking is not time-critical.
const EXPIRY_THROTTLE_MS = 30_000;
const lastRunAt = new Map<string, number>();

function throttleKey(where: Record<string, unknown>): string {
  if (typeof where.therapistId === 'string') return `therapist:${where.therapistId}`;
  if (typeof where.patientUserId === 'string') return `patient:${where.patientUserId}`;
  return 'global';
}

export async function expireStaleBookings(fastify: FastifyInstance, where: Record<string, unknown> = {}) {
  const key = throttleKey(where);
  const last = lastRunAt.get(key);
  if (last !== undefined && Date.now() - last < EXPIRY_THROTTLE_MS) return;
  lastRunAt.set(key, Date.now());

  const stale = await fastify.prisma.bookingRequest.findMany({
    where: { ...where, status: 'PENDING', responseDueAt: { lt: new Date() } },
    select: { id: true, slotId: true },
  });
  if (stale.length === 0) return;
  await fastify.prisma.$transaction([
    fastify.prisma.bookingRequest.updateMany({
      where: { id: { in: stale.map((b) => b.id) } },
      data: { status: 'EXPIRED' },
    }),
    ...stale
      .filter((b) => b.slotId)
      .map((b) =>
        fastify.prisma.therapistSlot.update({
          where: { id: b.slotId! },
          data: { status: 'AVAILABLE' },
        }),
      ),
  ]);
}
