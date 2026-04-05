import { LoginForm } from '../../components/login-form';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo-full.png" alt="Revio" style={{ height: 48, marginBottom: 8 }} />
        </div>
        <h1 className="login-title">Willkommen zurück</h1>
        <p className="login-copy">
          Melde dich an, um freiberufliche Therapeut:innen in einer ruhigen Moderationsoberfläche zu prüfen und freizugeben.
        </p>

        <LoginForm />

        {process.env.NODE_ENV === 'development' ? (
          <div className="login-hint">
            Lokaler Hinweis: Admin-Zugangsdaten bitte nur in der Entwicklungsumgebung verwenden.
          </div>
        ) : null}
      </div>
    </div>
  );
}
