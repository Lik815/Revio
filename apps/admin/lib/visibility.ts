import { humanizeBlockingReason, reviewStatusPriority } from './review-status';
import { summarizeValues } from './format';

type TherapistVisibilityShape = {
  reviewStatus: string;
  isVisible: boolean;
  createdAt: string;
  bio?: string | null;
  specializations?: string[];
  languages?: string[];
  visibility: {
    visibilityState: string;
    blockingReasons: string[];
  };
};

export function missingProfileCount(therapist: Pick<TherapistVisibilityShape, 'bio' | 'specializations' | 'languages'>) {
  let count = 0;
  if (!therapist.bio?.trim()) count++;
  if (!therapist.specializations?.length) count++;
  if (!therapist.languages?.length) count++;
  return count;
}

export function getReviewPriority(therapist: Pick<TherapistVisibilityShape, 'reviewStatus' | 'createdAt' | 'bio' | 'specializations' | 'languages'>) {
  const ageHours = (Date.now() - new Date(therapist.createdAt).getTime()) / (1000 * 60 * 60);
  const missingCount = missingProfileCount(therapist);
  const overdue = therapist.reviewStatus === 'PENDING_REVIEW' && ageHours >= 48;
  const label = overdue
    ? 'Über SLA'
    : therapist.reviewStatus === 'PENDING_REVIEW'
      ? 'Review offen'
      : therapist.reviewStatus === 'CHANGES_REQUESTED'
        ? 'Nachfassen'
        : therapist.reviewStatus === 'DRAFT'
          ? 'Unvollständig'
          : therapist.reviewStatus === 'APPROVED'
            ? 'Stabil'
            : 'Beobachten';

  const weight = (reviewStatusPriority[therapist.reviewStatus] ?? 9) * 1000 - ageHours + missingCount * 10 - (overdue ? 500 : 0);
  return { overdue, missingCount, label, weight };
}

export function getVisibilityMeta(therapist: Pick<TherapistVisibilityShape, 'reviewStatus' | 'isVisible' | 'visibility'>) {
  if (therapist.reviewStatus !== 'APPROVED') {
    return 'Wird nach Freigabe sichtbar.';
  }
  if (!therapist.isVisible) {
    return 'Manuell ausgeblendet.';
  }
  if (therapist.visibility.visibilityState === 'visible') {
    return 'Sichtbar in der Suche.';
  }
  const reasons = therapist.visibility.blockingReasons.map(humanizeBlockingReason);
  return summarizeValues(reasons) ?? 'Noch nicht sichtbar.';
}

export function getVisibilityBlockers(therapist: Pick<TherapistVisibilityShape, 'reviewStatus' | 'isVisible' | 'visibility'>) {
  const isApprovedButNotVisible = therapist.reviewStatus === 'APPROVED' && therapist.visibility.visibilityState !== 'visible';
  const sourceReasons = therapist.visibility.blockingReasons.length > 0
    ? therapist.visibility.blockingReasons
    : isApprovedButNotVisible
      ? ['manually_hidden']
      : [];

  return sourceReasons.map(humanizeBlockingReason);
}
