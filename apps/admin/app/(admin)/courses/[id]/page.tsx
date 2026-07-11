import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { CourseActions } from '../../../../components/action-buttons';
import { AdminSectionCard } from '../../../../components/admin-section-card';
import { api } from '../../../../lib/api';
import { formatDateTime } from '../../../../lib/format';
import { humanizeReviewStatus } from '../../../../lib/review-status';
import {
  approveCourse,
  rejectCourse,
  requestChangesCourse,
  suspendCourse,
} from '../../../../lib/actions';

type Props = {
  params: Promise<{ id: string }>;
};

const runStatusLabel: Record<string, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Veröffentlicht',
  PAUSED: 'Pausiert',
  CANCELLED: 'Abgesagt',
};

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params;
  const course = await api.getAdminCourse(id);

  const reviewCopy: Record<string, string> = {
    DRAFT: 'Der Therapeut hat den Kurs noch nicht eingereicht.',
    PENDING_REVIEW: 'Wartet aktuell auf Prüfung.',
    APPROVED: 'Freigegeben. Durchläufe mit Terminen sind öffentlich sichtbar.',
    REJECTED: 'Abgelehnt.',
    CHANGES_REQUESTED: 'Der Therapeut wurde um Änderungen gebeten.',
    SUSPENDED: 'Gesperrt – aktuell nicht öffentlich sichtbar.',
  };

  return (
    <PageShell
      title={course.title}
      description={`${course.category?.label ?? course.category?.key ?? '—'} · ${course.therapist?.fullName ?? course.practice?.name ?? '—'}`}
      eyebrow={<Link href="/courses" className="page-back-link">← Zurück zur Liste</Link>}
      actions={
        <span className={`badge badge--${course.reviewStatus}`}>
          {humanizeReviewStatus(course.reviewStatus)}
        </span>
      }
    >
      <section className="card-grid" style={{ marginBottom: 24 }}>
        <article className="card">
          <div className="kicker">Review</div>
          <div className={`badge badge--${course.reviewStatus}`} style={{ width: 'fit-content', marginTop: 8 }}>
            {humanizeReviewStatus(course.reviewStatus)}
          </div>
          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            {reviewCopy[course.reviewStatus] ?? ''}
          </p>
          {course.adminNote && (
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Notiz: {course.adminNote}
            </p>
          )}
        </article>

        <article className="card">
          <div className="kicker">Anbieter</div>
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>
            {course.therapist?.fullName ?? course.practice?.name ?? '—'}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            {course.therapist?.email ?? course.practice?.city ?? ''}
          </p>
        </article>

        <article className="card">
          <div className="kicker">Zeitpunkte</div>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Erstellt {formatDateTime(course.createdAt)}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Aktualisiert {formatDateTime(course.updatedAt)}
          </p>
        </article>
      </section>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Review-Entscheidung
        </div>
        <CourseActions
          id={course.id}
          status={course.reviewStatus}
          actions={{
            approve: approveCourse,
            reject: rejectCourse,
            requestChanges: requestChangesCourse,
            suspend: suspendCourse,
          }}
        />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Kursdetails</div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Format</dt>
            <dd style={{ margin: 0 }}>{course.locationType}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Kursleitung</dt>
            <dd style={{ margin: 0 }}>{course.instructorName}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Zielgruppe</dt>
            <dd style={{ margin: 0 }}>{course.targetAudience || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Voraussetzungen</dt>
            <dd style={{ margin: 0 }}>{course.prerequisites || '–'}</dd>
            <dt style={{ color: 'var(--muted)', fontSize: 13 }}>Krankenkasse</dt>
            <dd style={{ margin: 0 }}>{course.healthInsuranceEligible ? 'Ja' : 'Nein'}{course.zppVerified ? ' (ZPP geprüft)' : ''}</dd>
          </dl>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Beschreibung</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{course.description}</p>
        </div>
      </section>

      <AdminSectionCard
        eyebrow="Durchläufe"
        title="Durchläufe & Termine"
        description="Nur Durchläufe mit mindestens einem Termin können veröffentlicht werden."
      >
        {course.runs.length === 0 ? (
          <p className="table-note">Noch kein Durchlauf angelegt.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {course.runs.map((run) => (
              <div key={run.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <strong>{run.label || 'Ohne Bezeichnung'}</strong>
                  <span className={`badge badge--${run.status === 'PUBLISHED' ? 'APPROVED' : run.status === 'CANCELLED' ? 'REJECTED' : 'DRAFT'}`}>
                    {runStatusLabel[run.status] ?? run.status}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  {run.city ? `${run.city} · ` : ''}Max. {run.maxParticipants} Teilnehmer
                  {run._count ? ` · ${run._count.enrollments} angemeldet` : ''}
                </p>
                {run.sessions && run.sessions.length > 0 ? (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--muted)' }}>
                    {run.sessions.map((s) => (
                      <li key={s.id}>
                        {formatDateTime(s.startsAt)} – {new Date(s.endsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {s.location ? ` · ${s.location}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>Noch keine Termine.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </PageShell>
  );
}
