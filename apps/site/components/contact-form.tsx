'use client';

import emailjs from '@emailjs/browser';
import { FormEvent, useState } from 'react';

const roleOptions = [
  { value: 'Patient:in', label: 'Patient:in' },
  { value: 'Therapeut:in', label: 'Therapeut:in' },
];

type Status = 'idle' | 'sending' | 'success' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0].value);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? '';
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? '';
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? '';

    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          from_name: name || 'Anonym',
          from_email: email,
          role,
          message: message || '—',
        },
        { publicKey },
      );
      setStatus('success');
      setName('');
      setEmail('');
      setRole(roleOptions[0].value);
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
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
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
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
        <span>Ich bin</span>
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

      {status === 'error' && (
        <p className="form-error">
          Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut oder schreib uns direkt per E-Mail.
        </p>
      )}

      <div className="contact-form__footer">
        <button
          type="submit"
          className="button button--primary"
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Wird gesendet…' : 'Nachricht senden'}
        </button>
      </div>
    </form>
  );
}
