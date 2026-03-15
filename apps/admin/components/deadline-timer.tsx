'use client';

import { useEffect, useState } from 'react';

const DEADLINE_HOURS = 48;

function getRemaining(createdAt: string) {
  const deadline = new Date(createdAt).getTime() + DEADLINE_HOURS * 60 * 60 * 1000;
  return deadline - Date.now();
}

function formatRemaining(ms: number) {
  if (ms <= 0) return { label: 'Abgelaufen', urgent: true, expired: true };
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    urgent: h < 6,
    expired: false,
  };
}

function formatElapsed(createdAt: string) {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const elapsedH = Math.floor(elapsed / 3600000);
  const elapsedD = Math.floor(elapsedH / 24);
  return elapsedD > 0 ? `vor ${elapsedD}d erledigt` : `vor ${elapsedH}h erledigt`;
}

export function DeadlineTimer({ createdAt, status }: { createdAt: string; status: string }) {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    setMounted(true);
    setRemaining(getRemaining(createdAt));

    if (status !== 'PENDING_REVIEW') return;
    const id = setInterval(() => setRemaining(getRemaining(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt, status]);

  // Before hydration: show a neutral placeholder to avoid mismatch
  if (!mounted) {
    return <span className="deadline-timer" style={{ opacity: 0.4 }}>…</span>;
  }

  if (status !== 'PENDING_REVIEW') {
    return (
      <span className="deadline-timer deadline-timer--done">
        ✓ {formatElapsed(createdAt)}
      </span>
    );
  }

  const { label, urgent, expired } = formatRemaining(remaining);
  return (
    <span className={`deadline-timer${urgent ? ' deadline-timer--urgent' : ''}${expired ? ' deadline-timer--expired' : ''}`}>
      {expired ? '⚠️ ' : urgent ? '⏳ ' : '🕐 '}
      {label}
    </span>
  );
}
