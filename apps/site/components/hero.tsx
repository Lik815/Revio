import Link from 'next/link';

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
            <div className="hero-search">
              <span className="hero-search__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                className="hero-search__input"
                placeholder={searchPlaceholder}
                readOnly
                aria-label="Beschwerden eingeben"
              />
              <span className="hero-search__divider" />
              <span className="hero-search__filter" aria-label="Filter">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
              </span>
            </div>
          )}

          {chips && chips.length > 0 && (
            <div className="hero-chips">
              {chips.map((chip) => (
                <span key={chip} className="hero-chip">{chip}</span>
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
          <div className="hero-card">
            <div className="hero-product">
              <div className="hero-product__topline">
                <span className="hero-product__dot" />
                Geprüfte Profile
              </div>
              <div className="hero-product__search">
                <span>⌕</span>
                Rückenschmerzen
              </div>
              <div className="hero-product__list">
                <div className="hero-product__item">
                  <div className="hero-product__avatar">R</div>
                  <div>
                    <strong>Rückentherapie</strong>
                    <span>3 passende Physios in deiner Nähe</span>
                  </div>
                </div>
                <div className="hero-product__item">
                  <div className="hero-product__avatar hero-product__avatar--muted">T</div>
                  <div>
                    <strong>Termin anfragen</strong>
                    <span>Freie Slots und direkter Kontakt</span>
                  </div>
                </div>
              </div>
              <div className="hero-product__status">
                <span className="hero-product__pill">Hausbesuch</span>
                <span className="hero-product__pill">Geprüft</span>
              </div>
            </div>
            <div className="hero-card__label">Revio App</div>
            <div className="hero-card__text">
              Beschwerde eingeben. Geprüfte Therapeut:innen finden. Direkt anfragen.
            </div>
            <div className="hero-card__meta">
              Suchen · Vergleichen · Anfragen
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
