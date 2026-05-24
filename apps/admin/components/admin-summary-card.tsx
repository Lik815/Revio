import Link from 'next/link';
import { ReactNode } from 'react';

export function AdminSummaryCard({
  kicker,
  value,
  label,
  tone = 'default',
  href,
  meta,
}: {
  kicker: string;
  value: ReactNode;
  label: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  href?: string;
  meta?: ReactNode;
}) {
  const content = (
    <article className={`review-summary-card review-summary-card--${tone}${href ? ' review-summary-card--interactive' : ''}`}>
      <div className="kicker">{kicker}</div>
      <strong>{value}</strong>
      <span>{label}</span>
      {meta ? <div className="review-summary-card__meta">{meta}</div> : null}
    </article>
  );

  if (!href) return content;

  return (
    <Link href={href} className="summary-link">
      {content}
    </Link>
  );
}
