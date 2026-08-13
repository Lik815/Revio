'use client';

import { useEffect } from 'react';

/**
 * The mobile homepage opens as a calm, full-viewport composition. Once the
 * visitor starts to scroll, collapse that reserved space so the next section
 * arrives immediately instead of leaving an empty stretch to scroll through.
 */
export function HomeHeroScrollReveal() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.hero--app-home');
    const mobile = window.matchMedia('(max-width: 720px)');
    if (!hero || !mobile.matches) return;

    let revealed = false;
    const reveal = () => {
      if (revealed || window.scrollY < 12) return;
      revealed = true;
      hero.classList.add('hero--scroll-revealed');
      window.removeEventListener('scroll', reveal);
    };

    window.addEventListener('scroll', reveal, { passive: true });
    reveal();
    return () => window.removeEventListener('scroll', reveal);
  }, []);

  return null;
}
