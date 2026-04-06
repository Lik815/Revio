'use client';

import { FormEvent, useState } from 'react';

type ContactFormProps = {
  contactEmail: string;
};

const roleOptions = [
  { value: 'Patient:in', label: 'Patient:in' },
  { value: 'Therapeut:in', label: 'Therapeut:in' },
];

export function ContactForm({ contactEmail }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0].value);
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Revio Kontaktanfrage · ${role}`);
    const body = encodeURIComponent(
      [
        `Name: ${name || '-'}`,
        `E-Mail: ${email || '-'}`,
        `Rolle: ${role}`,
        '',
        message || '-',
      ].join('\n'),
    );

    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dein Name" />
        </label>

        <label className="field">
          <span>E-Mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="dein.name@beispiel.de"
          />
        </label>
      </div>

      <label className="field">
        <span>Ich bin</span>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
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
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Wobei können wir helfen?"
          rows={6}
        />
      </label>

      <div className="contact-form__footer">
        <p className="form-note">
          Der Versand läuft in dieser MVP-Version bewusst einfach über dein Standard-Mailprogramm.
        </p>
        <button type="submit" className="button button--primary">
          E-Mail vorbereiten
        </button>
      </div>
    </form>
  );
}
