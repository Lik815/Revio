'use client';

import { useActionState } from 'react';
import { loginAdmin, type LoginState } from '../lib/actions';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialState);

  return (
    <form action={action} className="login-form">
      <label className="field">
        <span>E-Mail</span>
        <input name="email" type="email" placeholder="admin@revio.de" defaultValue="admin@revio.de" required />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input name="password" type="password" placeholder="••••••••" defaultValue="admin123" required />
      </label>
      {state.error ? (
        <div
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: '14px',
            padding: '12px 14px',
            color: '#b91c1c',
            fontSize: '0.95rem',
          }}
        >
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? 'Einloggen...' : 'Einloggen'}
      </button>
    </form>
  );
}
