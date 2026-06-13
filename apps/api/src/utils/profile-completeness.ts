import type { TherapistProfileStatus } from '@revio/shared';

type TherapistLike = {
  fullName?: string | null;
  professionalTitle?: string | null;
  city?: string | null;
  bio?: string | null;
  specializations?: string | null;
  languages?: string | null;
  reviewStatus?: string | null;
  employmentStatus?: string | null;
  isVisible?: boolean | null;
  isPublished?: boolean | null;
  homeVisit?: boolean | null;
  serviceRadiusKm?: number | null;
  kassenart?: string | null;
  taxRegistrationStatus?: string | null;
  healthAuthorityStatus?: string | null;
};

type TherapistPracticeLinkLike = {
  status?: string | null;
  practice?: {
    reviewStatus?: string | null;
  } | null;
};

const hasText = (value?: string | null) => !!value && value.trim() !== '';

export function getTherapistProfileCompletion(therapist: TherapistLike, { requireBio = false } = {}) {
  const missingFields: string[] = [];

  if (!hasText(therapist.fullName)) missingFields.push('fullName');
  if (!hasText(therapist.professionalTitle)) missingFields.push('professionalTitle');
  if (!hasText(therapist.city)) missingFields.push('city');
  if (!hasText(therapist.specializations)) missingFields.push('specializations');
  if (!hasText(therapist.languages)) missingFields.push('languages');
  if (requireBio && !hasText(therapist.bio)) missingFields.push('bio');

  return { complete: missingFields.length === 0, missingFields };
}

export function getTherapistPublicationState(
  therapist: TherapistLike,
  options?: { links?: TherapistPracticeLinkLike[] },
) {
  const reviewApproved = therapist.reviewStatus === 'APPROVED';
  const visible = therapist.isVisible === true;
  // PREPARING profiles are never publicly visible, regardless of review/completion.
  // Default to self-employed when the field is absent (legacy rows pre-migration).
  const selfEmployed = (therapist.employmentStatus ?? 'SELF_EMPLOYED') === 'SELF_EMPLOYED';
  const practiceCompletion = getTherapistProfileCompletion(therapist);
  const publicSearchEligible =
    reviewApproved &&
    visible &&
    selfEmployed &&
    practiceCompletion.complete;

  const blockingReasons: string[] = [];
  if (!reviewApproved) blockingReasons.push('not_approved');
  if (!visible) blockingReasons.push('manually_hidden');
  if (!selfEmployed) blockingReasons.push('employment_preparing');
  if (!practiceCompletion.complete) {
    blockingReasons.push('profile_incomplete');
  }

  return {
    practiceCompletion,
    reviewApproved,
    visible,
    eligibleViaMobilePath: false,
    eligibleViaPracticePath: publicSearchEligible,
    hasConfirmedApprovedPractice: options?.links
      ? options.links.some(
          (link) => link.status === 'CONFIRMED' && link.practice?.reviewStatus === 'APPROVED',
        )
      : false,
    publicSearchEligible,
    blockingReasons,
    // Legacy-kompatible Felder
    complete: practiceCompletion.complete,
    missingFields: practiceCompletion.missingFields,
    explicitlyPublished: therapist.isPublished === true,
  };
}

export function getTherapistRequestabilityState(
  therapist: TherapistLike & { bookingMode?: string | null; nextFreeSlotAt?: Date | string | null },
  options?: { links?: TherapistPracticeLinkLike[] },
) {
  const publication = getTherapistPublicationState(therapist, options);
  const blockingReasons: string[] = [];

  if (!publication.publicSearchEligible) blockingReasons.push(...publication.blockingReasons);
  if (therapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') blockingReasons.push('booking_mode_disabled');

  return {
    requestable: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

type TherapistChecklistLike = TherapistLike & {
  certifications?: string | null;
  photo?: string | null;
  street?: string | null;
  houseNumber?: string | null;
};

/**
 * Detailed profile completion used by GET /auth/me and the therapist dashboard
 * checklist. `readyForReview` reflects only the minimum criteria required to
 * submit for admin review — it never changes reviewStatus on its own; the
 * explicit POST /therapists/me/submit-for-review endpoint owns that transition.
 */
export function getTherapistProfileCompletionDetail(therapist: TherapistChecklistLike) {
  const has = (v?: string | null) => !!v && v.trim() !== '';
  const selfEmployed = (therapist.employmentStatus ?? 'SELF_EMPLOYED') === 'SELF_EMPLOYED';

  // Full checklist (drives the percentage shown in the dashboard).
  const items: { key: string; done: boolean }[] = [
    { key: 'name', done: has(therapist.fullName) },
    { key: 'city', done: has(therapist.city) },
    { key: 'specializations', done: has(therapist.specializations) },
    { key: 'languages', done: has(therapist.languages) },
    { key: 'photo', done: has(therapist.photo) },
    { key: 'certifications', done: has(therapist.certifications) },
    { key: 'kassenart', done: has(therapist.kassenart) },
    {
      key: 'homeVisitRadius',
      done: therapist.homeVisit !== true || (therapist.serviceRadiusKm ?? 0) > 0,
    },
    { key: 'address', done: has(therapist.street) && has(therapist.houseNumber) },
    { key: 'employmentStatus', done: selfEmployed },
  ];

  const completedItems = items.filter((i) => i.done).map((i) => i.key);
  const missingItems = items.filter((i) => !i.done).map((i) => i.key);
  const percentage = Math.round((completedItems.length / items.length) * 100);

  // The profile may only be submitted for review once it is fully complete
  // (every checklist item done — which also implies a self-employed status).
  const readyForReview = missingItems.length === 0;

  return { percentage, completedItems, missingItems, readyForReview };
}

export function getProfileStatus(therapist: TherapistLike): TherapistProfileStatus {
  const completion = getTherapistProfileCompletion(therapist);

  if (!completion.complete) return 'draft';
  if (
    therapist.taxRegistrationStatus === 'yes' &&
    therapist.healthAuthorityStatus === 'yes'
  ) {
    return 'ready_for_review';
  }

  return 'incomplete';
}
