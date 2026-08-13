'use client';

import { useEffect, useRef } from 'react';

// Ab wie vielen Pixeln Scroll-Distanz der Spacer einklappt. Kombiniert mit
// der Regel unten (nur bei scrollY === 0 wieder ausklappen) ergibt das eine
// klare Hysterese statt eines Togglens rund um eine einzelne Schwelle.
const COLLAPSE_THRESHOLD = 24;
const FALLBACK_REVEAL_DURATION_MS = 900;

// Liest die Dauer aus der zentralen CSS-Variable (globals.css), damit JS und
// CSS-Transition nie auseinanderlaufen.
function readRevealDurationMs(): number {
  if (typeof window === 'undefined') return FALLBACK_REVEAL_DURATION_MS;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--hero-reveal-duration').trim();
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) return FALLBACK_REVEAL_DURATION_MS;
  return raw.endsWith('s') && !raw.endsWith('ms') ? parsed * 1000 : parsed;
}

/**
 * The mobile homepage opens as a calm, at-least-viewport-tall composition.
 * Only a dedicated decorative spacer below the hero content reserves that
 * extra height — once the visitor scrolls down, this component collapses
 * just the spacer (height measured in JS, then animated to 0) so the next
 * section follows immediately. The hero itself never resizes, so Safari's
 * dvh changes from appearing/disappearing browser chrome never trigger an
 * animation — only this deliberate, explicit toggle does.
 */
export function HomeHeroScrollReveal() {
  const collapsedRef = useRef(false);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.hero--app-home');
    const spacer = document.querySelector<HTMLElement>('.hero-app-home__spacer');
    const mobile = window.matchMedia('(max-width: 720px)');
    if (!hero || !spacer || !mobile.matches) return;

    let expandedHeight = spacer.getBoundingClientRect().height;
    let expandTimeoutId: number | null = null;
    const revealDurationMs = readRevealDurationMs();

    const clearExpandTimeout = () => {
      if (expandTimeoutId !== null) {
        window.clearTimeout(expandTimeoutId);
        expandTimeoutId = null;
      }
    };

    const collapse = () => {
      if (collapsedRef.current) return;
      collapsedRef.current = true;
      clearExpandTimeout();
      hero.classList.add('hero--scroll-revealed');
      expandedHeight = spacer.getBoundingClientRect().height;
      spacer.style.height = `${expandedHeight}px`;
      spacer.setAttribute('data-collapsing', 'true');
      // Reflow erzwingen, damit der Übergang zur neuen Höhe animiert statt zu springen.
      void spacer.offsetHeight;
      spacer.style.height = '0px';
    };

    const expand = () => {
      if (!collapsedRef.current) return;
      collapsedRef.current = false;
      hero.classList.remove('hero--scroll-revealed');
      spacer.setAttribute('data-collapsing', 'true');
      spacer.style.height = `${expandedHeight}px`;
      clearExpandTimeout();
      // Nach Abschluss der Animation zurück zu flex:1/auto, damit der Spacer
      // wieder auf Viewport-Änderungen (z. B. dvh) reagiert.
      expandTimeoutId = window.setTimeout(() => {
        spacer.removeAttribute('data-collapsing');
        spacer.style.height = '';
        expandTimeoutId = null;
      }, revealDurationMs + 50);
    };

    let frameId: number | null = null;
    const evaluate = () => {
      frameId = null;
      const y = window.scrollY;
      if (y === 0) expand();
      else if (y > COLLAPSE_THRESHOLD) collapse();
      // Zwischen 0 und der Schwelle bleibt der aktuelle Zustand erhalten.
    };

    const onScroll = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(evaluate);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      clearExpandTimeout();
    };
  }, []);

  return null;
}
