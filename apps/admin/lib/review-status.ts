export const reviewStatusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  CHANGES_REQUESTED: 'Änderungen',
  SUSPENDED: 'Gesperrt',
  DRAFT: 'Entwurf',
  CONFIRMED: 'Bestätigt',
  PROPOSED: 'Vorgeschlagen',
  DISPUTED: 'Konflikt',
};

export const reviewStatusPriority: Record<string, number> = {
  PENDING_REVIEW: 0,
  CHANGES_REQUESTED: 1,
  DRAFT: 2,
  REJECTED: 3,
  SUSPENDED: 4,
  APPROVED: 5,
};

export const blockingReasonLabel: Record<string, string> = {
  publication_incomplete: 'Freigabe noch unvollständig',
  profile_incomplete: 'Profil unvollständig',
  manually_hidden: 'Manuell versteckt',
  publication_missing: 'Freigabe fehlt',
  no_home_visit: 'Kein Hausbesuch',
  no_service_radius: 'Kein Einzugsgebiet',
  no_kassenart: 'Keine Kassenart',
};

export function humanizeReviewStatus(status: string) {
  return reviewStatusLabel[status] ?? status.replace(/_/g, ' ');
}

export function humanizeBlockingReason(reason: string) {
  return blockingReasonLabel[reason] ?? reason.replace(/_/g, ' ');
}
