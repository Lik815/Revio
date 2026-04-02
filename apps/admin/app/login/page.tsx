import { LoginForm } from '../../components/login-form';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Revio Admin</div>
        <h1 className="login-title">Willkommen zurück</h1>
        <p className="login-copy">
          Melde dich an, um Therapeut:innen, Praxen und Verknüpfungen in einer zentralen Moderationsoberfläche zu verwalten.
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
