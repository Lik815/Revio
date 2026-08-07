import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteApiBaseCandidates } from '../../../lib/api-base';
import { ClaimForm } from '../../../components/claim-form';

export const metadata: Metadata = {
  title: 'Praxis übernehmen',
  robots: { index: false, follow: false },
};

async function getClaimInfo(id: string) {
  for (const base of getSiteApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}/claim/practice/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) continue;
      return (await res.json()) as { id: string; name: string; city: string; claimed: boolean };
    } catch {
      continue;
    }
  }
  return null;
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = await getClaimInfo(id);
  if (!info) notFound();

  return (
    <section className="section section--search">
      <div className="shell">
        <div className="section-heading">
          <div className="eyebrow">Praxis übernehmen</div>
          <h1>{info.name}</h1>
          <p className="section-copy">{info.city}</p>
        </div>

        {info.claimed ? (
          <div className="surface-card" style={{ marginTop: 20, maxWidth: 480 }}>
            <p style={{ margin: 0 }}>Diese Praxis wurde bereits übernommen.</p>
          </div>
        ) : (
          <>
            <p style={{ maxWidth: 480 }}>
              Bestätige deine E-Mail-Adresse, lege ein Passwort fest und übernimm das Profil — danach kannst du
              es selbst bearbeiten.
            </p>
            <ClaimForm practiceId={info.id} />
          </>
        )}
      </div>
    </section>
  );
}
