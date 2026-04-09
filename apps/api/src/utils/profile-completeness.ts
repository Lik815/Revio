import type { TherapistProfileStatus } from '@revio/shared';

type TherapistLike = {
  fullName?: string | null;
  professionalTitle?: string | null;
  city?: string | null;
  bio?: string | null;
  specializations?: string | null;
  languages?: string | null;
  reviewStatus?: string | null;
  isVisible?: boolean | null;
  isPublished?: boolean | null;
  onboardingStatus?: string | null;
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
  const requiresExplicitPublication =
    therapist.onboardingStatus === 'manager_onboarding' ||
    therapist.onboardingStatus === 'invited' ||
    therapist.onboardingStatus === 'claimed';
  const publishedOk = !requiresExplicitPublication || therapist.isPublished === true;
  const practiceCompletion = getTherapistProfileCompletion(therapist, { requireBio: requiresExplicitPublication });
  const publicSearchEligible =
    reviewApproved &&
    visible &&
    publishedOk &&
    practiceCompletion.complete;

  const blockingReasons: string[] = [];
  if (!reviewApproved) blockingReasons.push('not_approved');
  if (!visible) blockingReasons.push('manually_hidden');
  if (requiresExplicitPublication && !therapist.isPublished) blockingReasons.push('publication_missing');
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
