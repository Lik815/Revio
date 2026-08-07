'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

type OwnedPractice = {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  hours?: string | null;
  description?: string | null;
  homeVisit: boolean;
};

export default function KontoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [practice, setPractice] = useState<OwnedPractice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('revio_owner_token');
    setToken(stored);
    if (!stored) {
      setLoading(false);
      return;
    }
    fetch(`${apiBase()}/claim/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('Sitzung abgelaufen. Bitte übernimm die Praxis erneut.');
        const body = await res.json();
        setPractice(body.practice);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unbekannter Fehler.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !practice) return;
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch(`${apiBase()}/claim/me/update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          city: String(formData.get('city') ?? ''),
          address: String(formData.get('address') ?? ''),
          phone: String(formData.get('phone') ?? ''),
          hours: String(formData.get('hours') ?? ''),
          description: String(formData.get('description') ?? ''),
          homeVisit: formData.get('homeVisit') === 'on',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Speichern fehlgeschlagen.');
      }
      const body = await res.json();
      setPractice(body.practice);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    }
  }

  if (loading) {
    return (
      <section className="section section--search">
        <div className="shell">
          <p>Lädt…</p>
        </div>
      </section>
    );
  }

  if (!token || error) {
    return (
      <section className="section section--search">
        <div className="shell">
          <div className="section-heading">
            <div className="eyebrow">Konto</div>
            <h1>Nicht angemeldet</h1>
            <p className="section-copy">{error ?? 'Bitte übernimm zuerst deine Praxis über die jeweilige Profilseite.'}</p>
          </div>
          <Link href="/finden" className="button button--primary">Zur Suche</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section section--search">
      <div className="shell">
        <div className="section-heading">
          <div className="eyebrow">Konto</div>
          <h1>{practice?.name}</h1>
          <p className="section-copy">Verwalte die Angaben deiner Praxis.</p>
        </div>

        {saved ? <p style={{ color: 'var(--success, #2f6b46)' }}>Gespeichert.</p> : null}

        <form onSubmit={handleSubmit} className="surface-card" style={{ display: 'grid', gap: 12, maxWidth: 480, marginTop: 20 }}>
          <label className="field">
            <span>Name</span>
            <input name="name" defaultValue={practice?.name} required />
          </label>
          <label className="field">
            <span>Stadt</span>
            <input name="city" defaultValue={practice?.city} required />
          </label>
          <label className="field">
            <span>Adresse</span>
            <input name="address" defaultValue={practice?.address ?? ''} />
          </label>
          <label className="field">
            <span>Telefon</span>
            <input name="phone" defaultValue={practice?.phone ?? ''} />
          </label>
          <label className="field">
            <span>Öffnungszeiten</span>
            <input name="hours" defaultValue={practice?.hours ?? ''} />
          </label>
          <label className="field">
            <span>Beschreibung</span>
            <textarea name="description" defaultValue={practice?.description ?? ''} rows={4} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="homeVisit" defaultChecked={practice?.homeVisit ?? false} />
            Hausbesuche möglich
          </label>
          <button type="submit" className="button button--primary">Speichern</button>
        </form>
      </div>
    </section>
  );
}
