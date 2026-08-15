import { Prisma } from '@prisma/client';
import { getTherapistPublicationState } from './profile-completeness.js';

/**
 * Zentrale Sichtbarkeitsregel für Praxen.
 *
 * Eine Praxis ist öffentlich sichtbar, wenn ALLE vier Bedingungen gelten:
 *  1. reviewStatus ist APPROVED oder LISTED
 *     (LISTED = operator-angelegt/importiert, öffentlich aber ohne
 *     "Geprüft"-Signal — siehe Directory-First-Refactor P2. `verified` ist
 *     ausschließlich APPROVED vorbehalten.)
 *  2. vollständige Adresse: Straße, Hausnummer, PLZ und Stadt gesetzt
 *  3. geokodiert: lat/lng nicht beide 0
 *  4. mindestens ein CONFIRMED-Link auf ein öffentlich sichtbares
 *     Therapeut:innenprofil (getTherapistPublicationState.publicSearchEligible
 *     plus archivedAt == null)
 *
 * Diese Datei ist die einzige Quelle dieser Regel. Suche, Therapeut:innen-Detail,
 * Praxis-Detail und Praxislisten verwenden sie einheitlich.
 */

export type PracticeVisibilityLike = {
  reviewStatus?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type PublicTherapistLike = {
  reviewStatus?: string | null;
  isVisible?: boolean | null;
  employmentStatus?: string | null;
  archivedAt?: Date | string | null;
  fullName?: string | null;
  professionalTitle?: string | null;
  city?: string | null;
  specializations?: string | null;
  languages?: string | null;
};

export type PracticeLinkLike = {
  status?: string | null;
  therapist?: PublicTherapistLike | null;
};

const hasText = (value?: string | null) => !!value && value.trim() !== '';

/** Öffentlich sichtbare Praxis-Reviewstatus. LISTED bleibt bewusst enthalten. */
export const PUBLIC_PRACTICE_REVIEW_STATUSES = ['APPROVED', 'LISTED'] as const;

/**
 * "Volle Adresse": Straße, Hausnummer, PLZ und Stadt. Voraussetzung für die
 * Live-Schaltung (docs/praxis-pflichtdaten-umsetzung.md, Abschnitt 4).
 */
export function hasFullPracticeAddress(p: PracticeVisibilityLike): boolean {
  return Boolean(
    hasText(p.street) && hasText(p.houseNumber) && hasText(p.postalCode) && hasText(p.city),
  );
}

/** Geokodiert = mindestens eine Koordinate ist gesetzt und != 0. */
export function isPracticeGeocoded(p: PracticeVisibilityLike): boolean {
  const lat = p.lat ?? 0;
  const lng = p.lng ?? 0;
  return !(lat === 0 && lng === 0);
}

/**
 * Ist dieses Therapeut:innenprofil öffentlich sichtbar? Ergänzt die vorhandene
 * Publikationslogik um den Archiv-Check (archivierte Profile sind nie öffentlich).
 */
export function isPublicTherapist(t?: PublicTherapistLike | null): boolean {
  if (!t) return false;
  if (t.archivedAt) return false;
  return getTherapistPublicationState(t).publicSearchEligible;
}

/** Links, die eine Praxis öffentlich tragen: CONFIRMED + öffentliche:r Therapeut:in. */
export function getPublicPracticeLinks<T extends PracticeLinkLike>(links: T[]): T[] {
  return links.filter((l) => l.status === 'CONFIRMED' && isPublicTherapist(l.therapist));
}

export type PracticeVisibilityResult = {
  isPublic: boolean;
  /** "Geprüft"-Badge — nur APPROVED, nie LISTED. */
  verified: boolean;
  /** Anzahl der öffentlich sichtbaren, verknüpften Therapeut:innen. */
  publicTherapistCount: number;
  blockingReasons: string[];
};

/**
 * Vollständige Sichtbarkeitsprüfung. `links` muss die Links der Praxis samt
 * `therapist` enthalten — ohne Links kann Bedingung 4 nicht erfüllt sein.
 */
export function getPracticeVisibilityState(
  practice: PracticeVisibilityLike,
  links: PracticeLinkLike[] = [],
): PracticeVisibilityResult {
  const blockingReasons: string[] = [];

  const statusPublic = PUBLIC_PRACTICE_REVIEW_STATUSES.includes(
    (practice.reviewStatus ?? '') as (typeof PUBLIC_PRACTICE_REVIEW_STATUSES)[number],
  );
  if (!statusPublic) blockingReasons.push('not_approved');
  if (!hasFullPracticeAddress(practice)) blockingReasons.push('address_incomplete');
  if (!isPracticeGeocoded(practice)) blockingReasons.push('not_geocoded');

  const confirmedLinks = links.filter((l) => l.status === 'CONFIRMED');
  if (confirmedLinks.length === 0) blockingReasons.push('no_confirmed_link');

  const publicLinks = getPublicPracticeLinks(links);
  if (publicLinks.length === 0 && confirmedLinks.length > 0) {
    blockingReasons.push('no_public_therapist');
  }

  return {
    isPublic: blockingReasons.length === 0,
    verified: practice.reviewStatus === 'APPROVED',
    publicTherapistCount: publicLinks.length,
    blockingReasons,
  };
}

/** Kurzform für Aufrufer, die nur das Ja/Nein brauchen. */
export function isPublicPractice(
  practice: PracticeVisibilityLike,
  links: PracticeLinkLike[] = [],
): boolean {
  return getPracticeVisibilityState(practice, links).isPublic;
}

/**
 * Prisma-Vorfilter, der die DB-seitig prüfbaren Teile der Regel abbildet
 * (Status, Adressfelder, mindestens ein CONFIRMED-Link auf ein öffentliches
 * Profil). Die Geokodierung und die Trim-Semantik der Adressfelder werden
 * anschließend in JS über getPracticeVisibilityState() nachgeprüft — der Filter
 * allein ist bewusst NICHT ausreichend.
 */
export const publicPracticeWhere = {
  reviewStatus: { in: [...PUBLIC_PRACTICE_REVIEW_STATUSES] },
  street: { not: null },
  houseNumber: { not: null },
  postalCode: { not: null },
  links: {
    some: {
      status: 'CONFIRMED',
      therapist: {
        reviewStatus: 'APPROVED',
        isVisible: true,
        employmentStatus: 'SELF_EMPLOYED',
        archivedAt: null,
      },
    },
  },
} satisfies Prisma.PracticeWhereInput;

/**
 * Include, der genau die Felder lädt, die getPracticeVisibilityState() für
 * Bedingung 4 braucht. Bewusst minimal (DSGVO DS-21/22 — Feldminimierung).
 */
export const practiceVisibilityInclude = {
  links: {
    where: { status: 'CONFIRMED' },
    select: {
      status: true,
      therapist: {
        select: {
          reviewStatus: true,
          isVisible: true,
          employmentStatus: true,
          archivedAt: true,
          fullName: true,
          professionalTitle: true,
          city: true,
          specializations: true,
          languages: true,
        },
      },
    },
  },
} satisfies Prisma.PracticeInclude;
