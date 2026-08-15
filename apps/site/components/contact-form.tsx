'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '../lib/content';

const roleOptions = [
  { value: 'Physio finden', label: 'Ich suche Physiotherapie' },
  { value: 'Therapeut:in', label: 'Ich arbeite therapeutisch' },
  { value: 'Allgemeine Frage', label: 'Allgemeine Frage' },
];

type Status = 'idle' | 'sending' | 'success' | 'error';

// Getrennt gehaltene Fehlerarten: Ein "nochmal versuchen" hilft nur beim
// temporären Fehler — bei einem Kanalproblem schickt es Leute ins Leere.
type ErrorKind = 'temporary' | 'channel';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

export function ContactForm({ defaultMessage }: { defaultMessage?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0].value);
  const [message, setMessage] = useState(defaultMessage ?? '');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorKind, setErrorKind] = useState<ErrorKind>('temporary');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    try {
      const res = await fetch(`${apiBase()}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, message, website }),
      });

      if (!res.ok) {
        // 503 = Zustellkanal nicht konfiguriert, 502 = Versand abgelehnt.
        // In beiden Fällen bringt ein erneuter Versuch nichts.
        setErrorKind(res.status === 503 || res.status === 502 ? 'channel' : 'temporary');
        setStatus('error');
        return;
      }

      setStatus('success');
      setName('');
      setEmail('');
      setRole(roleOptions[0].value);
      setMessage('');
      setWebsite('');
    } catch {
      setErrorKind('temporary');
      setStatus('error');
    }
  };

  // Eine stets gemountete aria-live-Region, damit sowohl der Erfolgszustand
  // als auch der Wechsel des Button-Labels ("Wird gesendet…") zuverlässig
  // angesagt werden — ein neu eingefügtes aria-live-Element wird von
  // Screenreadern nicht garantiert erkannt.
  return (
    <div aria-live="polite" aria-atomic="true">
      {status === 'success' ? (
        <div className="contact-form contact-form--feedback">
          <div className="contact-form__success">
            <div className="contact-form__success-icon">✓</div>
            <h3>Nachricht gesendet</h3>
            <p>Wir melden uns bald bei dir.</p>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setStatus('idle')}
            >
              Neue Nachricht schreiben
            </button>
          </div>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>
                Name <span className="field__optional">(optional)</span>
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dein Name"
              />
            </label>

            <label className="field">
              <span>E-Mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dein.name@beispiel.de"
                required
              />
            </label>
          </div>

          <label className="field">
            <span>Anliegen</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Nachricht</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Wobei können wir helfen?"
              rows={6}
              required
            />
          </label>

          {/* Honeypot — vor Menschen und Screenreadern verborgen, für Bots sichtbar. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          {status === 'error' && (
            <p className="form-error" role="alert">
              {errorKind === 'channel' ? (
                <>
                  Das Kontaktformular ist gerade nicht erreichbar. Schreib uns bitte direkt an{' '}
                  <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
                </>
              ) : (
                <>
                  Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut oder schreib uns
                  direkt an <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
                </>
              )}
            </p>
          )}

          <p className="form-note contact-form__privacy">
            Mit dem Absenden werden deine Angaben zur Bearbeitung deiner Anfrage verwendet. Weitere
            Informationen findest du in unserer <Link href="/datenschutz">Datenschutzerklärung</Link>.
          </p>

          <div className="contact-form__footer">
            <button
              type="submit"
              className="button button--primary"
              disabled={status === 'sending'}
              aria-busy={status === 'sending'}
            >
              {status === 'sending' ? 'Wird gesendet…' : 'Nachricht senden'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
