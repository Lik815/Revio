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

export function getTherapistPublicationState(therapist: TherapistLike) {
  const completion = getTherapistProfileCompletion(therapist);
  const reviewApproved = therapist.reviewStatus === 'APPROVED';
  const visible = therapist.isVisible === true;
  const explicitlyPublished = therapist.isPublished === true;
  const requiresExplicitPublication =
    therapist.onboardingStatus === 'manager_onboarding' ||
    therapist.onboardingStatus === 'invited' ||
    therapist.onboardingStatus === 'claimed';

  const publicSearchEligible =
    reviewApproved &&
    visible &&
    (
      !requiresExplicitPublication ||
      (completion.complete && explicitlyPublished)
    );

  return {
    ...completion,
    reviewApproved,
    explicitlyPublished,
    publicSearchEligible,
  };
}
