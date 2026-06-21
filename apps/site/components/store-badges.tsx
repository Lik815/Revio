type StoreBadgesProps = {
  appleHref?: string;
  googleHref?: string;
  interactive?: boolean;
  className?: string;
};

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="store-badge__brand-icon store-badge__brand-icon--apple" viewBox="0 0 24 24">
      <path
        d="M16.82 12.6c.02 2.23 1.96 2.97 1.98 2.98-.02.05-.31 1.06-1.02 2.1-.61.9-1.25 1.8-2.25 1.82-.98.02-1.3-.58-2.42-.58-1.13 0-1.49.56-2.39.6- .96.04-1.7-.97-2.32-1.86-1.27-1.84-2.24-5.18-.94-7.45.65-1.13 1.81-1.84 3.07-1.86.96-.02 1.86.64 2.42.64.56 0 1.62-.79 2.73-.67.47.02 1.78.19 2.62 1.42-.07.04-1.56.91-1.54 2.76ZM15.03 4.92c.51-.62.86-1.48.77-2.34-.74.03-1.64.49-2.17 1.11-.48.56-.91 1.43-.79 2.27.82.06 1.67-.42 2.19-1.04Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg aria-hidden="true" className="store-badge__brand-icon store-badge__brand-icon--google" viewBox="0 0 24 24">
      <path d="M3.41 2.84 13.6 13 3.53 23.08A2 2 0 0 1 3 21.7V4.23c0-.53.16-1.02.41-1.39Z" fill="#00C2F2" />
      <path d="M14.86 14.27 18.22 17.6c.88-.48 1.48-1.18 1.78-2.1.17-.53.17-1.07 0-1.61-.29-.9-.9-1.6-1.77-2.08l-3.37 2.46Z" fill="#FFD000" />
      <path d="M3.41 2.84c.04-.06.08-.11.13-.17.65-.75 1.73-1 2.66-.57l11.99 6.71-4.59 4.19L3.41 2.84Z" fill="#32D74B" />
      <path d="M3.53 23.08 13.6 13l4.62 4.6-11.95 6.67c-.93.43-2.03.2-2.68-.58-.02-.02-.04-.04-.06-.07Z" fill="#FF4D67" />
    </svg>
  );
}

function StoreBadge({
  kind,
  href,
  interactive,
}: {
  kind: 'apple' | 'google';
  href: string;
  interactive: boolean;
}) {
  const content = (
    <>
      <span className="store-badge__brand" aria-hidden="true">
        {kind === 'apple' ? <AppleIcon /> : <GooglePlayIcon />}
      </span>
      <span className="store-badge__copy">
        <span className="store-badge__overline">
          {kind === 'apple' ? 'DOWNLOAD ON THE' : 'GET IT ON'}
        </span>
        <span className="store-badge__label">
          {kind === 'apple' ? 'App Store' : 'Google Play'}
        </span>
      </span>
    </>
  );

  if (!interactive) {
    return (
      <div className="store-badge" aria-hidden="true">
        {content}
      </div>
    );
  }

  return (
    <a href={href} className="store-badge">
      {content}
    </a>
  );
}

export function StoreBadges({
  appleHref = '#',
  googleHref = '#',
  interactive = false,
  className = '',
}: StoreBadgesProps) {
  return (
    <div className={`store-badges${className ? ` ${className}` : ''}`} aria-label="App Download Buttons">
      <StoreBadge kind="apple" href={appleHref} interactive={interactive} />
      <StoreBadge kind="google" href={googleHref} interactive={interactive} />
    </div>
  );
}
