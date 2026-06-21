'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';
import { PhoneMockup, type StoryFrame } from './phone-mockup';
import { ProgressIndicator } from './progress-indicator';
import { StorySection } from './story-section';

type StoryItem = StoryFrame & {
  step: string;
  title: string;
  body: string;
};

const STORY_ITEMS: StoryItem[] = [
  {
    id: 'home',
    step: '01',
    title: 'Finde die passende Physiotherapie.',
    body: 'Suche nach Beschwerden, Spezialisierungen oder Therapieformen.',
    label: 'Home Screen',
    imageSrc: '/media/story-home.png',
  },
  {
    id: 'search',
    step: '02',
    title: 'Beschwerden eingeben.',
    body: 'Gib einfach dein Anliegen ein, z.B. Rueckenschmerzen.',
    label: 'Suche nach Rueckenschmerzen',
    imageSrc: '/media/story-search.png',
  },
  {
    id: 'results',
    step: '03',
    title: 'Passende Therapeuten finden.',
    body: 'Vergleiche Profile, Leistungen und Verfuegbarkeit.',
    label: 'Search Results',
    imageSrc: '/media/story-search-results.png',
  },
  {
    id: 'profile',
    step: '04',
    title: 'Profile transparent vergleichen.',
    body: 'Sieh Sprachen, Hausbesuche, Spezialisierungen und Kontaktdaten.',
    label: 'Therapist Profile',
    imageSrc: '/media/story-therapist-profile.png',
  },
  {
    id: 'appointments-open',
    step: '05',
    title: 'Freie Termine sofort sehen.',
    body: 'Verfuegbare Termine werden direkt angezeigt.',
    label: 'Available Appointments',
    imageSrc: '/media/story-available-appointments.png',
  },
  {
    id: 'booking',
    step: '06',
    title: 'In wenigen Sekunden buchen.',
    body: 'Termin auswaehlen, Nachricht hinzufuegen und Anfrage senden.',
    label: 'Appointment Booking',
    imageSrc: '/media/story-appointment-booking.png',
  },
  {
    id: 'confirmation',
    step: '07',
    title: 'Bestaetigung erhalten.',
    body: 'Der Therapeut bestaetigt die Anfrage direkt ueber Revio.',
    label: 'Booking Confirmation',
    imageSrc: '/media/story-booking-confirmation.png',
  },
  {
    id: 'appointments',
    step: '08',
    title: 'Alle Termine im Blick.',
    body: 'Verwalte aktuelle und vergangene Termine zentral.',
    label: 'My Appointments',
    imageSrc: '/media/story-my-appointments.png',
  },
  {
    id: 'details',
    step: '09',
    title: 'Alle wichtigen Informationen an einem Ort.',
    body: 'Terminstatus, Therapeut, Hinweise und Kontaktdaten jederzeit verfuegbar.',
    label: 'Appointment Details',
    imageSrc: '/media/story-appointment-details.png',
  },
];

export function RevioStory() {
  const containerRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 24,
    mass: 0.9,
  });

  const currentIndexMotion = useTransform(smoothProgress, (value) => {
    const raw = Math.round(value * (STORY_ITEMS.length - 1));
    return Math.min(STORY_ITEMS.length - 1, Math.max(0, raw));
  });

  const progressWidth = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  const [currentIndex, setCurrentIndex] = useState(0);

  useMotionValueEvent(currentIndexMotion, 'change', (latest) => {
    setCurrentIndex(latest);
  });

  const activeFrame = useMemo(() => STORY_ITEMS[currentIndex] ?? STORY_ITEMS[0], [currentIndex]);
  const activeParallaxOffset = currentIndex % 2 === 0 ? 14 : -14;

  return (
    <section ref={containerRef} className="story-shell">
      <div className="story-backdrop story-backdrop--one" />
      <div className="story-backdrop story-backdrop--two" />
      <div className="shell story-grid">
        <div className="story-copy">
          <div className="story-copy__intro">
            <div className="eyebrow">App Erlebnis</div>
            <h2>Vom ersten Suchbegriff bis zur bestaetigten Behandlung.</h2>
            <p className="section-copy">
              Revio fuehrt Patienten Schritt fuer Schritt durch die Therapiesuche. Die App bleibt dabei
              klar, ruhig und sofort verstaendlich.
            </p>
          </div>

          <div className="story-progress-bar">
            <motion.span style={{ width: progressWidth }} />
          </div>

          <div className="story-copy__sections">
            {STORY_ITEMS.map((item, index) => (
              <StorySection
                key={item.id}
                step={item.step}
                title={item.title}
                body={item.body}
                active={index === currentIndex}
              />
            ))}
          </div>
        </div>

        <div className="story-device-column">
          <div className="story-device-sticky">
            <ProgressIndicator count={STORY_ITEMS.length} currentIndex={currentIndex} />
            <PhoneMockup frame={activeFrame} parallaxOffset={activeParallaxOffset} frameIndex={currentIndex} />
            <div className="story-device-caption">
              <span>{activeFrame.step}</span>
              <strong>{activeFrame.label}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="shell story-final-cta">
        <div className="story-final-cta__card">
          <div>
            <div className="eyebrow">Jetzt starten</div>
            <h2>Starte deine Therapie mit Revio.</h2>
          </div>
          <div className="story-final-cta__actions">
            <Link href="/finden" className="button button--primary">Therapeut finden</Link>
            <Link href="/contact" className="button button--ghost">App herunterladen</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
