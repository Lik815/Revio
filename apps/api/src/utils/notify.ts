import { PrismaClient } from '@prisma/client';

type NotifyInput = {
  userId?: string;
  therapistId?: string;
  type: string;
  message: string;
  bookingId?: string;
  inquiryId?: string;
  linkId?: string;
  practiceId?: string;
  reviewStatus?: string;
  actionLabel?: string;
};

// Einziger Schreibpfad für Notification-Zeilen — jeder Call-Ort, der bisher
// nur sendPushNotification aufgerufen hat, ruft jetzt zusätzlich notify()
// auf, damit Push und persistierte Mitteilung nie auseinanderlaufen.
export async function notify(prisma: PrismaClient, input: NotifyInput) {
  await prisma.notification.create({ data: input });
}
