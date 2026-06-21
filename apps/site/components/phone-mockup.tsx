'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export type StoryFrame = {
  id: string;
  label: string;
  imageSrc: string;
};

type PhoneMockupProps = {
  frame: StoryFrame;
  parallaxOffset: number;
  frameIndex: number;
};

function FallbackFrame({ label }: { label: string }) {
  return (
    <div className="story-phone__fallback">
      <div className="story-phone__fallback-badge">Revio App Screen</div>
      <strong>{label}</strong>
      <p>Screenshot-Platzhalter. Sobald die finalen PNGs im Projekt liegen, erscheint hier der echte Screen.</p>
    </div>
  );
}

export function PhoneMockup({ frame, parallaxOffset, frameIndex }: PhoneMockupProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [frame.imageSrc]);

  return (
    <div className="story-phone-wrap">
      <div className="story-phone-glow story-phone-glow--one" />
      <div className="story-phone-glow story-phone-glow--two" />
      <div className="story-phone">
        <div className="story-phone__dynamic-island" />
        <AnimatePresence mode="wait">
          <motion.div
            key={frame.id}
            className="story-phone__screen"
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: parallaxOffset }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.95 }}
          >
            {!imageFailed ? (
              <Image
                src={frame.imageSrc}
                alt={frame.label}
                fill
                className="story-phone__image"
                sizes="(max-width: 1024px) 70vw, 32vw"
                loading={frameIndex <= 1 ? 'eager' : 'lazy'}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <FallbackFrame label={frame.label} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
