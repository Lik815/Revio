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
        <input
          name="email"
          type="email"
          placeholder="admin@revio.de"
          autoComplete="username"
          required
        />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error ? (
        <div className="notice-box notice-box--danger">
          <div className="notice-box__icon">!</div>
          <div>{state.error}</div>
        </div>
      ) : null}
      <button type="submit" className="primary-btn" disabled={pending}>
        {pending ? 'Einloggen...' : 'Einloggen'}
      </button>
    </form>
  );
}
