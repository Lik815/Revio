import { CourseRunStatus, ReviewStatus } from '@prisma/client';

export function assertExactlyOneOwner(opts: {
  therapistId?: string | null;
  practiceId?: string | null;
}): void {
  const set = [opts.therapistId, opts.practiceId].filter(Boolean);
  if (set.length !== 1) {
    throw new Error(
      'Ein Kurs muss genau einem Anbieter gehören (entweder therapistId oder practiceId).',
    );
  }
}

export function assertRunPublishable(opts: {
  courseReviewStatus: ReviewStatus;
  sessionCount: number;
  maxParticipants: number;
}): void {
  if (opts.courseReviewStatus !== ReviewStatus.APPROVED) {
    throw new Error(
      'Ein Kursdurchlauf kann nur veröffentlicht werden, wenn der Kurs freigegeben ist.',
    );
  }
  if (opts.sessionCount < 1) {
    throw new Error(
      'Ein Kursdurchlauf muss mindestens einen Termin haben, bevor er veröffentlicht wird.',
    );
  }
  if (opts.maxParticipants < 1) {
    throw new Error('maxParticipants muss mindestens 1 sein.');
  }
}

export function assertEligibleConsistency(opts: {
  healthInsuranceEligible: boolean;
  zppVerified: boolean;
}): void {
  if (opts.zppVerified && !opts.healthInsuranceEligible) {
    throw new Error(
      'zppVerified kann nur true sein, wenn healthInsuranceEligible ebenfalls true ist.',
    );
  }
}

export const TERMINAL_RUN_STATUSES: CourseRunStatus[] = [CourseRunStatus.CANCELLED];

export function assertRunNotTerminal(status: CourseRunStatus): void {
  if (TERMINAL_RUN_STATUSES.includes(status)) {
    throw new Error('Ein abgesagter Kursdurchlauf kann nicht mehr verändert werden.');
  }
}
