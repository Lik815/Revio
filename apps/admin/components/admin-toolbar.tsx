import { ReactNode } from 'react';

export function AdminToolbar({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return <div className={`toolbar-shell${compact ? ' toolbar-shell--compact' : ''}`}>{children}</div>;
}
