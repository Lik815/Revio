import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicTherapist } from '../../../lib/public-api';
import { PublicTherapistProfile } from '../../../components/public-therapist-profile';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const therapist = await getPublicTherapist(id);

  if (!therapist) {
    return { title: 'Profil nicht gefunden', robots: { index: false, follow: false } };
  }

  const description = `${therapist.fullName}, ${therapist.professionalTitle} in ${therapist.city || 'Deutschland'}.${
    therapist.specializations.length > 0 ? ` Spezialisierung: ${therapist.specializations.slice(0, 3).join(', ')}.` : ''
  }`;

  return {
    title: `${therapist.fullName} – ${therapist.professionalTitle}`,
    description,
    alternates: { canonical: `/therapeut/${id}` },
    openGraph: { type: 'profile', title: therapist.fullName, description },
  };
}

export default async function TherapeutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const therapist = await getPublicTherapist(id);

  if (!therapist) notFound();

  return <PublicTherapistProfile therapist={therapist} />;
}
