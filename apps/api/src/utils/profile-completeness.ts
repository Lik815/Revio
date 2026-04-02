type TherapistLike = {
  fullName?: string | null;
  professionalTitle?: string | null;
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
  bookingMode?: string | null;
  nextFreeSlotAt?: Date | string | null;
};

type TherapistPracticeLinkLike = {
  status?: string | null;
  practice?: {
    reviewStatus?: string | null;
  } | null;
};

const hasText = (value?: string | null) => !!value && value.trim() !== '';

/**
 * Pfad A: Mobile-Therapeut (kein Praxis-Link erforderlich).
 * Pflichtfelder: Name, Titel, Spezialisierungen, Sprachen, homeVisit=true,
 * serviceRadiusKm>0, Kassenart.
 */
export function getMobileProfileCompletion(therapist: TherapistLike) {
  const missingFields: string[] = [];

  if (!hasText(therapist.fullName)) missingFields.push('fullName');
  if (!hasText(therapist.professionalTitle)) missingFields.push('professionalTitle');
  if (!hasText(therapist.specializations)) missingFields.push('specializations');
  if (!hasText(therapist.languages)) missingFields.push('languages');
  if (!therapist.homeVisit) missingFields.push('homeVisit');
  if (!therapist.serviceRadiusKm || therapist.serviceRadiusKm <= 0) missingFields.push('serviceRadiusKm');
  if (!hasText(therapist.kassenart)) missingFields.push('kassenart');

  return { complete: missingFields.length === 0, missingFields };
}

/**
 * Pfad B: Praxis-gebundener Therapeut (bisheriger Pfad).
 * Pflichtfelder: Name, Titel, Spezialisierungen, Sprachen.
 * Für manager-onboarding Therapeuten ist zusätzlich Bio erforderlich.
 */
export function getTherapistProfileCompletion(therapist: TherapistLike, { requireBio = false } = {}) {
  const missingFields: string[] = [];

  if (!hasText(therapist.fullName)) missingFields.push('fullName');
  if (!hasText(therapist.professionalTitle)) missingFields.push('professionalTitle');
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

  // Pfad A: Mobile-Therapeut ohne Praxis-Pflicht
  const mobileCompletion = getMobileProfileCompletion(therapist);
  const eligibleViaMobilePath =
    reviewApproved && visible && publishedOk && mobileCompletion.complete;

  // Pfad B: Praxis-gebundener Therapeut (bisheriger Pfad)
  const hasConfirmedApprovedPractice = options?.links
    ? options.links.some(
        (link) => link.status === 'CONFIRMED' && link.practice?.reviewStatus === 'APPROVED',
      )
    : false;
  const practiceCompletion = getTherapistProfileCompletion(therapist, { requireBio: requiresExplicitPublication });
  const eligibleViaPracticePath =
    reviewApproved &&
    visible &&
    publishedOk &&
    practiceCompletion.complete &&
    hasConfirmedApprovedPractice;

  const publicSearchEligible = eligibleViaMobilePath || eligibleViaPracticePath;

  const blockingReasons: string[] = [];
  if (!reviewApproved) blockingReasons.push('not_approved');
  if (!visible) blockingReasons.push('manually_hidden');
  if (requiresExplicitPublication && !therapist.isPublished) blockingReasons.push('publication_missing');
  if (!publicSearchEligible) {
    if (!therapist.homeVisit) blockingReasons.push('no_home_visit');
    if (!therapist.serviceRadiusKm || therapist.serviceRadiusKm <= 0) blockingReasons.push('no_service_radius');
    if (!hasText(therapist.kassenart)) blockingReasons.push('no_kassenart');
    if (!hasConfirmedApprovedPractice) blockingReasons.push('no_confirmed_practice_link');
  }

  return {
    mobileCompletion,
    practiceCompletion,
    reviewApproved,
    visible,
    eligibleViaMobilePath,
    eligibleViaPracticePath,
    hasConfirmedApprovedPractice,
    publicSearchEligible,
    blockingReasons,
    // Legacy-kompatible Felder
    complete: practiceCompletion.complete,
    missingFields: practiceCompletion.missingFields,
    explicitlyPublished: therapist.isPublished === true,
  };
}

export function getTherapistRequestabilityState(
  therapist: TherapistLike,
  options?: { links?: TherapistPracticeLinkLike[] },
) {
  const publication = getTherapistPublicationState(therapist, options);
  const blockingReasons = [...(publication.blockingReasons ?? [])];

  if (therapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') {
    blockingReasons.push('booking_mode_disabled');
  }

  return {
    requestable: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}
