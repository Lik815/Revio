import Link from 'next/link';
import Image from 'next/image';
import { CityInput } from './city-input';

type HeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  hideImage?: boolean;
  searchPlaceholder?: string;
  chips?: string[];
};

export function Hero({
  eyebrow,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  hideImage = false,
  searchPlaceholder,
  chips,
}: HeroProps) {
  return (
    <section className={`hero${hideImage ? ' hero--no-image' : ''}`}>
      <div className={`shell${hideImage ? '' : ' hero__grid'}`}>
        <div className="hero__copy">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="hero__body">{body}</p>

          {searchPlaceholder && (
            <form method="GET" action="/finden" className="hero-search">
              <span className="hero-search__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                className="hero-search__input hero-search__input--query"
                name="q"
                placeholder={searchPlaceholder}
                aria-label="Beschwerden eingeben"
              />
              <span className="hero-search__divider" />
              <CityInput name="city" placeholder="Ort" required wrapperClassName="hero-search__input--city" inputClassName="hero-search__input" />
              <button type="submit" className="hero-search__filter" aria-label="Suchen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </form>
          )}

          {chips && chips.length > 0 && (
            <div className="hero-chips">
              {chips.map((chip) => (
                <Link key={chip} href={`/finden?q=${encodeURIComponent(chip)}`} className="hero-chip">
                  {chip}
                </Link>
              ))}
            </div>
          )}

          <div className="hero__actions">
            <Link href={primaryHref} className="button button--primary">
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="button button--ghost">
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>

        {!hideImage && (
          <div className="hero-device">
            <Image
              src="/media/AppShowWeb-phone.png"
              alt="Revio App auf einem Smartphone"
              width={683}
              height={1468}
              className="hero-device__image"
              priority
            />
          </div>
        )}
      </div>
    </section>
  );
}
