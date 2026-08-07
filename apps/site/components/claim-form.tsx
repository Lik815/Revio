'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

type Step = 'email' | 'code' | 'account' | 'done';

export function ClaimForm({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Code konnte nicht gesendet werden.');
      }
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/register/confirm-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Ungültiger oder abgelaufener Code.');
      }
      setStep('account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/claim/practice/${encodeURIComponent(practiceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, agbAccepted, privacyAccepted }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Übernahme fehlgeschlagen.');
      }
      const body = await res.json();
      window.localStorage.setItem('revio_owner_token', body.token);
      setStep('done');
      router.push('/konto');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card" style={{ marginTop: 20, maxWidth: 480 }}>
      {error ? <p className="form-error">{error}</p> : null}

      {step === 'email' ? (
        <form onSubmit={sendCode} style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            <span>Deine E-Mail-Adresse</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dein.name@beispiel.de"
            />
          </label>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Wird gesendet…' : 'Code anfordern'}
          </button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form onSubmit={confirmCode} style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0 }}>Wir haben einen 6-stelligen Code an {email} geschickt.</p>
          <label className="field">
            <span>Code</span>
            <input
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </label>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Wird geprüft…' : 'Code bestätigen'}
          </button>
        </form>
      ) : null}

      {step === 'account' ? (
        <form onSubmit={submitClaim} style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            <span>Passwort festlegen</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
            <input type="checkbox" required checked={agbAccepted} onChange={(e) => setAgbAccepted(e.target.checked)} />
            <span>Ich akzeptiere die Nutzungsbedingungen.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              required
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
            />
            <span>Ich willige in die Verarbeitung meiner Daten gemäß Datenschutzerklärung ein.</span>
          </label>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Wird übernommen…' : 'Praxis übernehmen'}
          </button>
        </form>
      ) : null}

      {step === 'done' ? <p style={{ margin: 0 }}>Geschafft — du wirst weitergeleitet…</p> : null}
    </div>
  );
}
