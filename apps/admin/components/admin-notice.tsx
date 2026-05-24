import { ReactNode } from 'react';

export function AdminNotice({
  title,
  children,
  tone = 'default',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  return (
    <div className={`notice-box notice-box--${tone}`}>
      <div className="notice-box__icon" aria-hidden="true">!</div>
      <div className="notice-box__content">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
