import Link from 'next/link';
import { PageShell } from '../../../components/page-shell';
import { CourseActions } from '../../../components/action-buttons';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminSectionCard } from '../../../components/admin-section-card';
import { AdminStatusBadge } from '../../../components/admin-status-badge';
import { AdminSummaryCard } from '../../../components/admin-summary-card';
import { AdminToolbar } from '../../../components/admin-toolbar';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import {
  approveCourse,
  rejectCourse,
  requestChangesCourse,
  suspendCourse,
} from '../../../lib/actions';

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { courses } = await api.getAdminCourses();

  const statusFilter = params.status ?? 'ALL';
  const q = (params.q ?? '').toLowerCase();

  const filtered = courses
    .filter((course) => {
      const matchesStatus = statusFilter === 'ALL' || course.reviewStatus === statusFilter;
      const matchesQuery = !q || [course.title, course.therapist?.fullName, course.practice?.name, course.category?.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const pendingCount = filtered.filter((c) => c.reviewStatus === 'PENDING_REVIEW').length;
  const changesCount = filtered.filter((c) => c.reviewStatus === 'CHANGES_REQUESTED').length;
  const approvedCount = filtered.filter((c) => c.reviewStatus === 'APPROVED').length;
  const activeFilters = [params.q, statusFilter !== 'ALL' ? statusFilter : ''].filter(Boolean).length;

  return (
    <PageShell
      title="Gesundheitskurse"
      description="Von Therapeuten eingereichte Kurse prüfen und freigeben."
      eyebrow="Reviews"
      actions={<div className="hero-pill">{filtered.length} Kurse in der Ansicht</div>}
    >
      <div className="review-summary-grid">
        <AdminSummaryCard
          kicker="Offen"
          value={pendingCount}
          label="Warten auf Review"
          href="/courses?status=PENDING_REVIEW"
        />
        <AdminSummaryCard
          kicker="Rückfragen"
          value={changesCount}
          label="Änderungen angefragt"
          tone="warning"
          href="/courses?status=CHANGES_REQUESTED"
        />
        <AdminSummaryCard
          kicker="Freigegeben"
          value={approvedCount}
          label="Öffentlich sichtbar"
          tone="success"
          href="/courses?status=APPROVED"
        />
      </div>

      <AdminSectionCard
        eyebrow="Filter"
        title="Kurse eingrenzen"
        description="Suche nach Titel, Kategorie oder Anbieter."
        actions={activeFilters > 0 ? <Link href="/courses" className="secondary-btn secondary-btn--compact">Filter zurücksetzen</Link> : null}
      >
        <AdminToolbar>
          <form className="toolbar" action="/courses">
            <input name="q" defaultValue={params.q ?? ''} className="toolbar-input" placeholder="Titel, Kategorie oder Anbieter" />
            <select name="status" defaultValue={statusFilter} className="toolbar-select">
              <option value="ALL">Alle Status</option>
              <option value="PENDING_REVIEW">Ausstehend</option>
              <option value="APPROVED">Freigegeben</option>
              <option value="CHANGES_REQUESTED">Änderungen</option>
              <option value="REJECTED">Abgelehnt</option>
              <option value="SUSPENDED">Gesperrt</option>
              <option value="DRAFT">Entwurf</option>
            </select>
            <button className="primary-btn" type="submit">Anwenden</button>
          </form>
        </AdminToolbar>
      </AdminSectionCard>

      {filtered.length === 0 ? (
        <AdminEmptyState
          icon="📚"
          title="Keine Kurse für diese Filter"
          description="Versuche einen anderen Status oder entferne den Suchbegriff."
          compact
          action={<Link href="/courses" className="secondary-btn secondary-btn--compact">Alle Kurse anzeigen</Link>}
        />
      ) : (
        <AdminSectionCard
          eyebrow="Queue"
          title="Kurs-Arbeitsliste"
          description="Sortiert nach zuletzt aktualisiert – am längsten unbearbeitete Kurse zuerst."
          actions={<div className="hero-pill">{activeFilters > 0 ? `${activeFilters} aktive Filter` : 'Keine aktiven Filter'}</div>}
        >
          <table className="table table--elevated focus-table">
            <thead>
              <tr>
                <th>Kurs</th>
                <th>Anbieter</th>
                <th>Status</th>
                <th>Durchläufe</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => {
                const publishedRuns = course.runs.filter((r) => r.status === 'PUBLISHED').length;
                return (
                  <tr key={course.id}>
                    <td data-label="Kurs">
                      <div className="entity-block">
                        <Link href={`/courses/${course.id}`} className="entity-link">
                          {course.title}
                        </Link>
                        <div className="entity-meta">{course.category?.label ?? course.category?.key ?? '—'}</div>
                      </div>
                    </td>
                    <td data-label="Anbieter">
                      <div className="entity-block">
                        <span className="table-strong">{course.therapist?.fullName ?? course.practice?.name ?? '—'}</span>
                        <div className="entity-meta">{course.therapist?.email ?? course.practice?.city ?? ''}</div>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div className="priority-stack">
                        <AdminStatusBadge status={course.reviewStatus} />
                        <span className="entity-meta">Aktualisiert {formatDate(course.updatedAt)}</span>
                      </div>
                    </td>
                    <td data-label="Durchläufe">
                      <span className="entity-meta">
                        {course.runs.length === 0
                          ? 'Noch kein Durchlauf'
                          : `${course.runs.length} gesamt · ${publishedRuns} veröffentlicht`}
                      </span>
                    </td>
                    <td data-label="Aktionen">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminSectionCard>
      )}
    </PageShell>
  );
}
