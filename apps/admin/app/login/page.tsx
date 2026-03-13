import { loginAdmin } from '../../lib/actions';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Revio Admin</div>
        <h1 className="login-title">Willkommen zurück</h1>
        <p className="login-copy">
          Melde dich an, um Therapeut:innen, Praxen und Verknüpfungen in einer zentralen Moderationsoberfläche zu verwalten.
        </p>

        <form action={loginAdmin} className="login-form">
          <label className="field">
            <span>E-Mail</span>
            <input name="email" type="email" placeholder="admin@revio.de" defaultValue="admin@revio.de" required />
          </label>
          <label className="field">
            <span>Passwort</span>
            <input name="password" type="password" placeholder="••••••••" defaultValue="admin123" required />
          </label>
          <button type="submit" className="primary-btn">Einloggen</button>
        </form>

        <div className="login-hint">
          Standard lokal: <strong>admin@revio.de</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}