import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicPractice } from '../../../lib/public-api';
import { getSiteSettings } from '../../../lib/site-settings';
import { PublicPracticeProfile } from '../../../components/public-practice-profile';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicPractice(id);

  if (!data) {
    return { title: 'Praxis nicht gefunden', robots: { index: false, follow: false } };
  }

  const description = `${data.practice.name} in ${data.practice.city || 'Deutschland'}${
    data.practice.address ? `, ${data.practice.address}` : ''
  }.`;

  return {
    title: data.practice.name,
    description,
    alternates: { canonical: `/praxis/${id}` },
    openGraph: { type: 'website', title: data.practice.name, description },
  };
}

export default async function PraxisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, siteSettings] = await Promise.all([
    getPublicPractice(id),
    getSiteSettings(),
  ]);

  if (!data) notFound();

  return (
    <PublicPracticeProfile
      practice={data.practice}
      therapists={data.therapists}
      appBookingEnabled={siteSettings.appBookingEnabled}
    />
  );
}
