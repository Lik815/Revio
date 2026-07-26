// Datenexport für Betroffenenrechte — Art. 15 (Auskunft) + Art. 20 (Portabilität).
// DSGVO DS-40: eine Funktion, die ALLE personenbezogenen Daten einer Person über
// alle Tabellen hinweg in maschinenlesbarem Format (JSON) zusammenträgt.
//
// Zwei Regeln stehen hier in Spannung und werden bewusst aufgelöst:
//   - Vollständigkeit (Art. 15): die Person bekommt wirklich alles zu ihr.
//   - Keine P3-Geheimnisse im Export (DS-40 / P3-Regel): Passwörter, Session-/
//     Reset-/Verifizierungs-Tokens und Push-Tokens werden NIE exportiert.
// Deshalb selektieren die User-/Therapist-Selects Felder explizit (Deny by default);
// verknüpfte Tabellen ohne Geheimnis-Spalten werden vollständig übernommen.
//
// WICHTIG (DS-40): Neue Tabelle mit P1-Daten ⇒ hier ergänzen, sonst ist der Export
// unvollständig und der Merge zu blockieren.

type PrismaLike = any;

// Felder des User-Kontos ohne P3-Geheimnisse.
const userSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  kassenart: true,
  emailVerifiedAt: true,
  requiresEmailVerification: true,
  createdAt: true,
  updatedAt: true,
  // Bewusst NICHT: passwordHash, sessionToken, sessionTokenExpiresAt,
  // emailVerificationToken, passwordResetToken, passwordResetExpiresAt, expoPushToken
} as const;

// Felder des Therapeutenprofils ohne P3-Geheimnisse.
const therapistSelect = {
  id: true,
  email: true,
  fullName: true,
  professionalTitle: true,
  city: true,
  postalCode: true,
  street: true,
  houseNumber: true,
  locationPrecision: true,
  latitude: true,
  longitude: true,
  homeLat: true,
  homeLng: true,
  bio: true,
  homeVisit: true,
  isFreelancer: true,
  specializations: true,
  languages: true,
  certifications: true,
  heilmittel: true,
  kassenart: true,
  availability: true,
  serviceRadiusKm: true,
  gender: true,
  phone: true,
  employmentStatus: true,
  visibilityPreference: true,
  isPublished: true,
  isVisible: true,
  reviewStatus: true,
  bookingMode: true,
  createdAt: true,
  updatedAt: true,
  // Bewusst NICHT: passwordHash, sessionToken, sessionTokenExpiresAt, expoPushToken
} as const;

// Dokument-Metadaten ohne internen Speicherpfad.
const documentSelect = {
  id: true,
  originalName: true,
  mimetype: true,
  uploadedAt: true,
} as const;

export interface SubjectDataExport {
  exportedAt: string;
  subjectType: 'patient' | 'therapist';
  note: string;
  account: unknown | null;
  therapistProfile: unknown | null;
  data: Record<string, unknown>;
}

const PORTABILITY_NOTE =
  'Auskunft nach Art. 15 DSGVO. Zugangsdaten und technische Tokens (Passwort-Hash, ' +
  'Session-, Reset-, Verifizierungs- und Push-Tokens) sind bewusst nicht enthalten.';

/** Alle personenbezogenen Daten eines Patienten (User) exportieren. */
export async function exportPatientData(prisma: PrismaLike, userId: string): Promise<SubjectDataExport> {
  const [account, favorites, notifications, appFeedback, bookingRequests, reviewsWritten, patientRequests] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: userSelect }),
      prisma.userFavoriteTherapist.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.appFeedback.findMany({ where: { userId } }),
      prisma.bookingRequest.findMany({ where: { patientUserId: userId } }),
      prisma.therapistReview.findMany({ where: { patientUserId: userId } }),
      prisma.patientRequest.findMany({
        where: { patientUserId: userId },
        include: { inquiries: true, timeWindows: true, prescription: true },
      }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    subjectType: 'patient',
    note: PORTABILITY_NOTE,
    account: account ?? null,
    therapistProfile: null,
    data: { favorites, notifications, appFeedback, bookingRequests, reviewsWritten, patientRequests },
  };
}

/** Alle personenbezogenen Daten eines Therapeuten exportieren. */
export async function exportTherapistData(
  prisma: PrismaLike,
  therapistId: string,
  linkedUserId?: string | null,
): Promise<SubjectDataExport> {
  const [
    therapistProfile,
    account,
    notifications,
    practiceLinks,
    documents,
    workingHours,
    services,
    blockedTimes,
    absences,
    scheduledSlots,
    reviewsReceived,
    bookingRequests,
    inquiries,
    appFeedback,
  ] = await Promise.all([
    prisma.therapist.findUnique({ where: { id: therapistId }, select: therapistSelect }),
    linkedUserId ? prisma.user.findUnique({ where: { id: linkedUserId }, select: userSelect }) : Promise.resolve(null),
    prisma.notification.findMany({ where: { therapistId } }),
    prisma.therapistPracticeLink.findMany({ where: { therapistId }, include: { practice: true } }),
    prisma.therapistDocument.findMany({ where: { therapistId }, select: documentSelect }),
    prisma.therapistWorkingHoursRule.findMany({ where: { therapistId } }),
    prisma.therapistService.findMany({ where: { therapistId } }),
    prisma.therapistBlockedTime.findMany({ where: { therapistId } }),
    prisma.therapistAbsence.findMany({ where: { therapistId } }),
    prisma.scheduledSlot.findMany({ where: { therapistId } }),
    prisma.therapistReview.findMany({ where: { therapistId } }),
    prisma.bookingRequest.findMany({ where: { therapistId } }),
    prisma.inquiry.findMany({ where: { therapistId } }),
    linkedUserId ? prisma.appFeedback.findMany({ where: { userId: linkedUserId } }) : Promise.resolve([]),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    subjectType: 'therapist',
    note: PORTABILITY_NOTE,
    account: account ?? null,
    therapistProfile: therapistProfile ?? null,
    data: {
      notifications,
      practiceLinks,
      documents,
      workingHours,
      services,
      blockedTimes,
      absences,
      scheduledSlots,
      reviewsReceived,
      bookingRequests,
      inquiries,
      appFeedback,
    },
  };
}
