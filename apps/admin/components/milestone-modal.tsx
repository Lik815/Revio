'use client';

import { useEffect, useState } from 'react';

const MILESTONES = [500, 1000, 1500, 2000];
const STORAGE_KEY = 'revio_milestone_seen';

function getSeenMilestones(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function markSeen(milestone: number) {
  const seen = getSeenMilestones();
  if (!seen.includes(milestone)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, milestone]));
  }
}

const CONFETTI_CHARS = ['🎉', '🎊', '✨', '🥳', '🎈', '🌟', '💫', '🎆'];

function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 1.5}s`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
            fontSize: `${1 + Math.random() * 1.2}rem`,
          }}
        >
          {CONFETTI_CHARS[i % CONFETTI_CHARS.length]}
        </span>
      ))}
    </div>
  );
}

export function MilestoneModal({ total, preview }: { total: number; preview?: number }) {
  const [milestone, setMilestone] = useState<number | null>(preview ?? null);

  useEffect(() => {
    if (preview) return; // skip normal check in preview mode
    const seen = getSeenMilestones();
    const hit = MILESTONES.find((m) => total >= m && !seen.includes(m));
    if (hit) setMilestone(hit);
  }, [total, preview]);

  if (!milestone) return null;

  function dismiss() {
    markSeen(milestone!);
    setMilestone(null);
  }

  return (
    <div className="milestone-backdrop" onClick={dismiss} role="dialog" aria-modal="true" aria-label="Meilenstein erreicht">
      <div className="milestone-modal" onClick={(e) => e.stopPropagation()}>
        <Confetti />
        <div className="milestone-emoji">
          {milestone >= 2000 ? '👑' : milestone >= 1000 ? '🏆' : '🎉'}
        </div>
        <h2 className="milestone-title">
          {milestone.toLocaleString('de-DE')} Therapeut:innen!
        </h2>
        <p className="milestone-body">
          {milestone === 500
            ? 'Die 500er-Marke ist geknackt — Revio wächst! Halbzeit auf dem Weg zur ersten Tausend.'
            : milestone === 1000
            ? 'Unglaublich — 1.000 Therapeut:innen auf Revio! Ein riesiger Meilenstein für die Plattform.'
            : milestone === 1500
            ? 'Bereits 1.500 Therapeut:innen! Die Community wächst schneller als je zuvor.'
            : 'Wow — 2.000 Therapeut:innen! Revio ist jetzt eine der größten Plattformen seiner Art.'}
        </p>
        <button className="milestone-btn" onClick={dismiss} autoFocus>
          Weiter geht's 🚀
        </button>
      </div>
    </div>
  );
}
