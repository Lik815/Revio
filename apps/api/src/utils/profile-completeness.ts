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
};

type TherapistPracticeLinkLike = {
  status?: string | null;
  practice?: {
    reviewStatus?: string | null;
  } | null;
};

const hasText = (value?: string | null) => !!value && value.trim() !== '';

export function getTherapistProfileCompletion(therapist: TherapistLike) {
  const missingFields: string[] = [];

  if (!hasText(therapist.fullName)) missingFields.push('fullName');
  if (!hasText(therapist.professionalTitle)) missingFields.push('professionalTitle');
  if (!hasText(therapist.bio)) missingFields.push('bio');
  if (!hasText(therapist.specializations)) missingFields.push('specializations');
  if (!hasText(therapist.languages)) missingFields.push('languages');

  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}

export function getTherapistPublicationState(
  therapist: TherapistLike,
  options?: { links?: TherapistPracticeLinkLike[] },
) {
  const completion = getTherapistProfileCompletion(therapist);
  const reviewApproved = therapist.reviewStatus === 'APPROVED';
  const visible = therapist.isVisible === true;
  const explicitlyPublished = therapist.isPublished === true;
  const requiresExplicitPublication =
    therapist.onboardingStatus === 'manager_onboarding' ||
    therapist.onboardingStatus === 'invited' ||
    therapist.onboardingStatus === 'claimed';
  const hasConfirmedApprovedPractice = options?.links
    ? options.links.some((link) => link.status === 'CONFIRMED' && link.practice?.reviewStatus === 'APPROVED')
    : undefined;

  const publicSearchEligible =
    reviewApproved &&
    visible &&
    (
      !requiresExplicitPublication ||
      (completion.complete && explicitlyPublished)
    ) &&
    hasConfirmedApprovedPractice !== false;

  return {
    ...completion,
    reviewApproved,
    explicitlyPublished,
    hasConfirmedApprovedPractice,
    publicSearchEligible,
  };
}
