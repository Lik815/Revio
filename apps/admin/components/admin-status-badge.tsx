import { humanizeReviewStatus } from '../lib/review-status';

export function AdminStatusBadge({
  status,
  label,
  className = '',
}: {
  status?: string;
  label?: string;
  className?: string;
}) {
  const resolvedLabel = label ?? (status ? humanizeReviewStatus(status) : '');
  const badgeClass = status ? `badge badge--${status}` : 'badge';

  return <span className={`${badgeClass} ${className}`.trim()}>{resolvedLabel}</span>;
}
