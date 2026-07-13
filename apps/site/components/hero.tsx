import Link from 'next/link';
import Image from 'next/image';
import { HeroSearchBar } from './hero-search-bar';
import { StoreBadges } from './store-badges';

type HeroProps = {
  eyebrow?: string;
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
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          <p className="hero__body">{body}</p>

          {searchPlaceholder ? <HeroSearchBar placeholder={searchPlaceholder} /> : null}

          {chips && chips.length > 0 ? (
            <div className="hero-chips">
              {chips.map((chip) => (
                <Link key={chip} href={`/finden?q=${encodeURIComponent(chip)}`} className="hero-chip">
                  {chip}
                </Link>
              ))}
            </div>
          ) : null}

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

        {!hideImage ? (
          <div className="hero-device">
            <div className="hero-device__stack">
              <Image
                src="/media/iphone17pro-orange-mockup.png"
                alt="Revio App auf einem Smartphone"
                width={1800}
                height={3660}
                className="hero-device__image"
                priority
              />
              <StoreBadges />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
