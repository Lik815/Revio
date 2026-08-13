'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { searchPatientsAction, type PatientSearchState } from '../lib/actions';
import { AdminEmptyState } from './admin-empty-state';
import { AdminNotice } from './admin-notice';
import { formatDate } from '../lib/format';

const initialState: PatientSearchState = { query: '', results: [], error: null };

export function PatientSearch() {
  const [state, formAction, pending] = useActionState(searchPatientsAction, initialState);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form action={formAction} className="toolbar">
        <input
          name="q"
          defaultValue={state.query}
          className="toolbar-input"
          placeholder="E-Mail, Name oder Buchungs-ID"
          autoComplete="off"
        />
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? 'Suche…' : 'Suchen'}
        </button>
      </form>

      {state.error ? <AdminNotice tone="warning" title="Suche fehlgeschlagen">{state.error}</AdminNotice> : null}

      {!state.error && state.query && state.results.length === 0 ? (
        <AdminEmptyState
          icon="🔍"
          title="Keine Treffer"
          description="Kein Patient mit dieser E-Mail, diesem Namen oder dieser Buchungs-ID gefunden."
          compact
        />
      ) : null}

      {state.results.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {state.results.map((result) =>
            result.type === 'patient' ? (
              <Link key={result.id} href={`/patients/${result.id}`} className="card" style={{ padding: '16px 20px', display: 'block' }}>
                <div className="entity-cell">
                  <div className="entity-avatar">{(result.firstName ?? result.email).slice(0, 1).toUpperCase()}</div>
                  <div className="entity-block">
                    <div className="entity-link">
                      {[result.firstName, result.lastName].filter(Boolean).join(' ') || 'Ohne Namen'}
                    </div>
                    <div className="entity-meta">{result.email}</div>
                    <div className="entity-meta">Registriert seit {formatDate(result.createdAt)}</div>
                  </div>
                </div>
              </Link>
            ) : (
              <div key={result.bookingId} className="card" style={{ padding: '16px 20px' }}>
                <div className="entity-block">
                  <div className="entity-link" style={{ color: 'inherit' }}>{result.patientName}</div>
                  <div className="entity-meta">
                    {result.patientEmail ?? 'Keine E-Mail hinterlegt'} · Gastbuchung ohne Konto
                  </div>
                  <div className="entity-meta">Buchung {result.bookingId} · Status {result.status}</div>
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
