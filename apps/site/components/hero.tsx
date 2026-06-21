'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import { StoreBadges } from './store-badges';
import { PhoneMockup, type StoryFrame } from './phone-mockup';
import { ProgressIndicator } from './progress-indicator';

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

type HeroStoryItem = StoryFrame & {
  step: string;
  storyTitle: string;
  storyBody: string;
};

const HERO_STORY_ITEMS: HeroStoryItem[] = [
  {
    id: 'home',
    step: '01',
    storyTitle: 'Finde die passende Physiotherapie.',
    storyBody: 'Suche nach Beschwerden, Spezialisierungen oder Therapieformen.',
    label: 'Home Screen',
    imageSrc: '/media/parallax-01.png',
  },
  {
    id: 'search',
    step: '02',
    storyTitle: 'Beschwerden eingeben.',
    storyBody: 'Gib einfach dein Anliegen ein, zum Beispiel Rueckenschmerzen.',
    label: 'Suche nach Rueckenschmerzen',
    imageSrc: '/media/parallax-02.jpeg',
  },
  {
    id: 'results',
    step: '03',
    storyTitle: 'Passende Therapeuten finden.',
    storyBody: 'Vergleiche Profile, Leistungen und Verfuegbarkeit.',
    label: 'Search Results',
    imageSrc: '/media/parallax-03.jpeg',
  },
  {
    id: 'profile',
    step: '04',
    storyTitle: 'Profile transparent vergleichen.',
    storyBody: 'Sieh Sprachen, Hausbesuche, Spezialisierungen und Kontaktdaten.',
    label: 'Therapeutenprofil',
    imageSrc: '/media/parallax-04.jpeg',
  },
  {
    id: 'available',
    step: '05',
    storyTitle: 'Freie Termine sofort sehen.',
    storyBody: 'Verfuegbare Termine werden direkt angezeigt.',
    label: 'Freie Termine',
    imageSrc: '/media/parallax-05.jpeg',
  },
  {
    id: 'booking',
    step: '06',
    storyTitle: 'In wenigen Sekunden buchen.',
    storyBody: 'Termin auswaehlen, Nachricht hinzufuegen und Anfrage senden.',
    label: 'Termin buchen',
    imageSrc: '/media/parallax-06.jpeg',
  },
  {
    id: 'confirmation',
    step: '07',
    storyTitle: 'Bestaetigung erhalten.',
    storyBody: 'Der Therapeut bestaetigt die Anfrage direkt ueber Revio.',
    label: 'Buchungsbestaetigung',
    imageSrc: '/media/parallax-07.jpeg',
  },
  {
    id: 'appointments',
    step: '08',
    storyTitle: 'Alle Termine im Blick.',
    storyBody: 'Verwalte aktuelle und vergangene Termine zentral.',
    label: 'Meine Termine',
    imageSrc: '/media/parallax-08.jpeg',
  },
  {
    id: 'details',
    step: '09',
    storyTitle: 'Alle wichtigen Informationen an einem Ort.',
    storyBody: 'Terminstatus, Therapeut, Hinweise und Kontaktdaten jederzeit verfuegbar.',
    label: 'Termindetails',
    imageSrc: '/media/parallax-09.jpeg',
  },
];

export function Hero({
  eyebrow,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  hideImage = false,
}: HeroProps) {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 24,
    mass: 0.9,
  });

  const currentIndexMotion = useTransform(smoothProgress, (value) => {
    const raw = Math.round(value * (HERO_STORY_ITEMS.length - 1));
    return Math.min(HERO_STORY_ITEMS.length - 1, Math.max(0, raw));
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  useMotionValueEvent(currentIndexMotion, 'change', (latest) => {
    setCurrentIndex(latest);
  });

  const activeStory = useMemo(() => HERO_STORY_ITEMS[currentIndex] ?? HERO_STORY_ITEMS[0], [currentIndex]);
  const activeParallaxOffset = currentIndex % 2 === 0 ? 16 : -16;

  return (
    <section ref={heroRef} className={`hero hero--scroll${hideImage ? ' hero--no-image' : ''}`}>
      <div className="hero-scroll-shell">
        <div className={`shell${hideImage ? '' : ' hero__grid hero__grid--scroll'}`}>
          <div className="hero__copy hero__copy--scroll">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStory.id}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 0.95 }}
              >
                {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
                <div className="hero-story-step">{activeStory.step}</div>
                <h1>{activeStory.storyTitle}</h1>
                <p className="hero__body">{activeStory.storyBody}</p>
              </motion.div>
            </AnimatePresence>

            <div className="hero__actions hero__actions--scroll">
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
            <div className="hero-device hero-device--scroll">
              <div className="hero-device__stack hero-device__stack--scroll">
                <ProgressIndicator count={HERO_STORY_ITEMS.length} currentIndex={currentIndex} />
                <PhoneMockup frame={activeStory} parallaxOffset={activeParallaxOffset} frameIndex={currentIndex} />
                <StoreBadges />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
