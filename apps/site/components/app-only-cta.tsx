import { StoreBadges } from './store-badges';

type AppOnlyCtaProps = {
  title: string;
  body: string;
  appleHref?: string;
  googleHref?: string;
};

export function AppOnlyCta({
  title,
  body,
  appleHref = '#',
  googleHref = '#',
}: AppOnlyCtaProps) {
  return (
    <div className="app-only-cta">
      <div className="eyebrow">Nur in der App</div>
      <h3>{title}</h3>
      <p>{body}</p>
      <StoreBadges
        appleHref={appleHref}
        googleHref={googleHref}
        interactive
        className="app-only-cta__stores"
      />
    </div>
  );
}
