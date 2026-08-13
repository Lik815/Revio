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

    let frameId: number | null = null;
    const updateRevealState = () => {
      frameId = null;
      // Der kleine Abstand verhindert ein Flackern rund um scrollY = 0.
      // Beim Zurückkehren an den Anfang wird die anfängliche, luftige
      // Startansicht wiederhergestellt.
      hero.classList.toggle('hero--scroll-revealed', window.scrollY > 18);
    };

    const onScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateRevealState);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateRevealState();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return null;
}
