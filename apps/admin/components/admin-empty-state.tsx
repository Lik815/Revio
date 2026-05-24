import { ReactNode } from 'react';

export function AdminEmptyState({
  icon,
  title,
  description,
  compact = false,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      <div className="empty-illustration" aria-hidden="true">{icon}</div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
