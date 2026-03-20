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

        <div className="login-hint">
          Standard lokal: <strong>admin@revio.de</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}
