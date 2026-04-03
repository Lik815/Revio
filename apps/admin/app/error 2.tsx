'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error.message.includes('API ')
    ? 'Die Admin-API ist gerade nicht erreichbar oder hat den Request abgelehnt.'
    : 'Beim Laden der Admin-Oberflaeche ist ein unerwarteter Fehler aufgetreten.';

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Revio Admin</div>
        <h1 className="login-title">Admin aktuell nicht verfuegbar</h1>
        <p className="login-copy">{message}</p>
        <div
          style={{
            background: 'rgba(80,109,122,0.08)',
            border: '1px solid rgba(80,109,122,0.14)',
            borderRadius: '16px',
            padding: '14px 16px',
            fontSize: '0.92rem',
            color: 'var(--muted)',
            marginBottom: '16px',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          <button type="button" className="primary-btn" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <div className="login-hint">
            Pruefe, ob die API lokal laeuft und ob dein Admin-Login noch gueltig ist.
          </div>
        </div>
      </div>
    </div>
  );
}
