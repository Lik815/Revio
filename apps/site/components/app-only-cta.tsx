type AppOnlyCtaProps = {
  title: string;
  body: string;
};

export function AppOnlyCta({ title, body }: AppOnlyCtaProps) {
  return (
    <div className="app-only-cta">
      <div className="eyebrow">Nur in der App</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
