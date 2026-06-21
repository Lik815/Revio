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
        d="M17.56 12.63c.03 2.8 2.46 3.73 2.48 3.74-.02.07-.39 1.32-1.28 2.62-.77 1.13-1.57 2.25-2.83 2.27-1.23.02-1.63-.73-3.03-.73-1.4 0-1.84.71-2.99.75-1.2.05-2.11-1.2-2.88-2.32-1.57-2.27-2.77-6.4-1.16-9.19.8-1.39 2.24-2.26 3.79-2.29 1.18-.02 2.3.8 3 .8.69 0 2.01-.99 3.39-.85.58.02 2.23.24 3.29 1.78-.09.05-1.94 1.13-1.92 3.42Zm-2.22-9.08c.61-.75 1.03-1.78.92-2.81-.93.04-2.05.58-2.72 1.32-.61.7-1.14 1.76-1 2.76 1.03.08 2.08-.51 2.8-1.27Z"
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
