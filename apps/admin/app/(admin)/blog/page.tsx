import Link from 'next/link';
import { PageShell } from '../../../components/page-shell';
import { createBlogPost, deleteBlogPost, toggleBlogPostPublish, updateBlogPost } from '../../../lib/actions';
import { api, type BlogPost } from '../../../lib/api';

type SearchParams = Promise<{ status?: string; q?: string; post?: string; mode?: string }>;

function formatDate(value: string | null) {
  if (!value) return 'Noch nicht veröffentlicht';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPublicPostUrl(slug: string) {
  return `https://my-revio.de/blog/${slug}`;
}

function getWordCount(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function renderContentPreview(content: string) {
  const lines = content.split('\n');
  const blocks: Array<
    | { type: 'heading'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'list'; items: string[] }
  > = [];

  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', items: listBuffer });
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();

    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
      continue;
    }

    blocks.push({ type: 'paragraph', text: line });
  }

  flushList();

  if (blocks.length === 0) {
    return <p className="table-note">Noch kein Inhalt vorhanden.</p>;
  }

  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      return <h4 key={`heading-${index}`}>{block.text}</h4>;
    }
    if (block.type === 'list') {
      return (
        <ul key={`list-${index}`} className="blog-preview-list">
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
    }
    return <p key={`paragraph-${index}`}>{block.text}</p>;
  });
}

function getStatusLabel(post: BlogPost) {
  return post.isPublished ? 'Live' : 'Entwurf';
}

function getStatusClass(post: BlogPost) {
  return post.isPublished ? 'badge badge--APPROVED' : 'badge badge--DRAFT';
}

function getReadingTime(content: string) {
  return Math.max(1, Math.round(getWordCount(content) / 180));
}

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const posts = await api.getBlogPosts();

  const query = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status === 'LIVE' || params.status === 'DRAFT' ? params.status : 'ALL';
  const mode = params.mode === 'new' ? 'new' : 'edit';

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const filteredPosts = sortedPosts.filter((post) => {
    const matchesStatus =
      statusFilter === 'ALL'
        || (statusFilter === 'LIVE' && post.isPublished)
        || (statusFilter === 'DRAFT' && !post.isPublished);

    const haystack = [post.title, post.slug, post.excerpt, post.authorName].join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);

    return matchesStatus && matchesQuery;
  });

  const publishedCount = posts.filter((post) => post.isPublished).length;
  const draftCount = posts.length - publishedCount;
  const recentlyUpdatedCount = posts.filter((post) => {
    const updatedAt = new Date(post.updatedAt).getTime();
    const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 2;
    return updatedAt >= twoDaysAgo;
  }).length;

  const selectedPost =
    mode === 'new'
      ? null
      : filteredPosts.find((post) => post.id === params.post)
        ?? filteredPosts[0]
        ?? sortedPosts[0]
        ?? null;

  const activePost = mode === 'new' ? null : selectedPost;
  const previewPost = activePost;

  return (
    <PageShell
      title="Blog"
      eyebrow="CMS"
      description="Ein kleiner Redaktionsbereich für Übersicht, Schreiben und Veröffentlichung an einem Ort."
      actions={<div className="hero-pill">{publishedCount} live</div>}
    >
      <div className="review-summary-grid">
        <article className="review-summary-card">
          <div className="kicker">Live</div>
          <strong>{publishedCount}</strong>
          <span>Öffentlich sichtbar</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Entwürfe</div>
          <strong>{draftCount}</strong>
          <span>Warten auf Veröffentlichung</span>
        </article>
        <article className="review-summary-card">
          <div className="kicker">Aktivität</div>
          <strong>{recentlyUpdatedCount}</strong>
          <span>In den letzten 48h bearbeitet</span>
        </article>
      </div>

      <section className="blog-cms-v2">
        <aside className="blog-cms-sidebar">
          <article className="panel panel--compact">
            <div className="panel-header">
              <div className="panel-header__content">
                <div className="kicker">Redaktion</div>
                <h3>Beiträge</h3>
                <p className="panel-header__description">
                  Suche, filtere und springe direkt in den passenden Beitrag.
                </p>
              </div>
              <Link href="/blog?mode=new" className="primary-btn">
                Neuer Beitrag
              </Link>
            </div>

            <form className="toolbar toolbar--compact blog-cms-toolbar" action="/blog">
              <input
                type="hidden"
                name="mode"
                value={mode}
              />
              <input
                name="q"
                defaultValue={params.q ?? ''}
                className="toolbar-input"
                placeholder="Titel, Slug oder Autor:in"
              />
              <select name="status" defaultValue={statusFilter} className="toolbar-select toolbar-input--sm">
                <option value="ALL">Alle</option>
                <option value="LIVE">Live</option>
                <option value="DRAFT">Entwürfe</option>
              </select>
              <button className="secondary-btn blog-filter-btn" type="submit">
                Filtern
              </button>
            </form>

            {filteredPosts.length === 0 ? (
              <div className="empty-state empty-state--compact blog-sidebar-empty">
                <div className="empty-illustration">🗂️</div>
                <div>
                  <h3>Keine Treffer</h3>
                  <p className="table-note">Passe Suche oder Filter an, um einen Beitrag zu finden.</p>
                </div>
              </div>
            ) : (
              <div className="blog-post-index">
                {filteredPosts.map((post) => {
                  const isActive = activePost?.id === post.id;
                  return (
                    <Link
                      key={post.id}
                      href={`/blog?post=${post.id}&status=${statusFilter}&q=${encodeURIComponent(params.q ?? '')}`}
                      className={`blog-post-index__item ${isActive ? 'blog-post-index__item--active' : ''}`}
                    >
                      <div className="blog-post-index__top">
                        <strong>{post.title}</strong>
                        <span className={getStatusClass(post)}>{getStatusLabel(post)}</span>
                      </div>
                      <p>{post.excerpt}</p>
                      <div className="blog-post-index__meta">
                        <span>/{post.slug}</span>
                        <span>Update {formatDate(post.updatedAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </aside>

        <div className="blog-cms-main">
          <section className="blog-cms-editor">
            {mode === 'new' ? (
              <article className="panel panel--compact blog-editor-card">
                <div className="panel-header">
                  <div className="panel-header__content">
                    <div className="kicker">Neu</div>
                    <h3>Beitrag schreiben</h3>
                    <p className="panel-header__description">
                      Titel und Inhalt reichen für den Start. Wenn das Slug-Feld leer bleibt, erzeugen wir es automatisch aus dem Titel.
                    </p>
                  </div>
                  <Link href="/blog" className="secondary-btn blog-open-link">
                    Zur Übersicht
                  </Link>
                </div>

                <form action={createBlogPost} className="blog-form">
                  <div className="blog-form__grid">
                    <label className="field">
                      <span>Titel</span>
                      <input name="title" placeholder="z. B. Mobile Physiotherapie finden" required />
                    </label>
                    <label className="field">
                      <span>Slug</span>
                      <input name="slug" placeholder="optional, wird sonst automatisch erzeugt" />
                    </label>
                  </div>

                  <label className="field">
                    <span>Excerpt</span>
                    <input name="excerpt" placeholder="Kurze Zusammenfassung für Liste und Suchvorschau." required />
                  </label>

                  <label className="field">
                    <span>Autor:in</span>
                    <input name="authorName" defaultValue="Revio Team" />
                  </label>

                  <label className="field">
                    <span>Inhalt</span>
                    <textarea
                      name="content"
                      rows={16}
                      placeholder={'Schreibe den Artikel hier.\n\n## Überschrift\n\nNormale Absätze bleiben lesbar.\n- Listen funktionieren ebenfalls.\n- Perfekt für einen ersten CMS-V2-Flow.'}
                      required
                    />
                  </label>

                  <div className="blog-editor-footer">
                    <div className="table-note">
                      Tipp: Für einen sauberen Redaktionsfluss erst speichern, dann prüfen und danach veröffentlichen.
                    </div>
                    <button className="primary-btn" type="submit">Beitrag anlegen</button>
                  </div>
                </form>
              </article>
            ) : activePost ? (
              <article className="panel panel--compact blog-editor-card">
                <div className="blog-editor-card__top">
                  <div>
                    <div className="kicker">Editor</div>
                    <h3>{activePost.title}</h3>
                    <p className="table-note">
                      {activePost.authorName} · erstellt {formatDate(activePost.createdAt)} · zuletzt geändert {formatDateTime(activePost.updatedAt)}
                    </p>
                  </div>
                  <div className="blog-editor-status">
                    <span className={getStatusClass(activePost)}>{getStatusLabel(activePost)}</span>
                    <Link href={getPublicPostUrl(activePost.slug)} target="_blank" className="secondary-btn blog-open-link">
                      Öffnen
                    </Link>
                  </div>
                </div>

                <form action={updateBlogPost.bind(null, activePost.id)} className="blog-form">
                  <div className="blog-form__grid">
                    <label className="field">
                      <span>Titel</span>
                      <input name="title" defaultValue={activePost.title} required />
                    </label>
                    <label className="field">
                      <span>Slug</span>
                      <input name="slug" defaultValue={activePost.slug} required />
                    </label>
                  </div>

                  <label className="field">
                    <span>Excerpt</span>
                    <input name="excerpt" defaultValue={activePost.excerpt} required />
                    <small className="field-help">{activePost.excerpt.length} Zeichen in der aktuellen Kurzfassung.</small>
                  </label>

                  <label className="field">
                    <span>Autor:in</span>
                    <input name="authorName" defaultValue={activePost.authorName} required />
                  </label>

                  <label className="field">
                    <span>Inhalt</span>
                    <textarea name="content" rows={18} defaultValue={activePost.content} required />
                    <small className="field-help">
                      {getWordCount(activePost.content)} Wörter · ca. {getReadingTime(activePost.content)} Min. Lesezeit
                    </small>
                  </label>

                  <div className="blog-editor-footer">
                    <div className="table-note">Speichern sichert den aktuellen Stand des Editors. Veröffentlichung und Löschen bleiben bewusst getrennte Aktionen.</div>
                    <button className="primary-btn" type="submit">Änderungen speichern</button>
                  </div>
                </form>

                <div className="blog-editor-secondary">
                  <form action={toggleBlogPostPublish.bind(null, activePost.id)}>
                    <button className="secondary-btn blog-inline-btn" type="submit">
                      {activePost.isPublished ? 'Als Entwurf führen' : 'Jetzt veröffentlichen'}
                    </button>
                  </form>
                  <Link href={getPublicPostUrl(activePost.slug)} target="_blank" className="secondary-btn blog-inline-btn">
                    Vorschau öffnen
                  </Link>
                  <form action={deleteBlogPost.bind(null, activePost.id)}>
                    <button className="action-btn action-btn--reject" type="submit">Beitrag löschen</button>
                  </form>
                </div>
              </article>
            ) : (
              <article className="panel panel--compact">
                <div className="empty-state empty-state--compact">
                  <div className="empty-illustration">✍️</div>
                  <div>
                    <h3>Noch kein Beitrag ausgewählt</h3>
                    <p className="table-note">Wähle links einen Beitrag aus oder starte direkt mit einem neuen Entwurf.</p>
                  </div>
                </div>
              </article>
            )}
          </section>

          <aside className="blog-cms-preview">
            <article className="panel panel--compact">
              <div className="panel-header">
                <div className="panel-header__content">
                  <div className="kicker">Vorschau</div>
                  <h3>Lesefluss prüfen</h3>
                  <p className="panel-header__description">
                    Eine ruhige Schnellvorschau für Überschriften, Absätze und Listen.
                  </p>
                </div>
              </div>

              {previewPost ? (
                <div className="blog-preview-shell">
                  <div className="blog-preview-header">
                    <span className={getStatusClass(previewPost)}>{getStatusLabel(previewPost)}</span>
                    <span className="entity-meta">{getReadingTime(previewPost.content)} Min. Lesezeit</span>
                  </div>
                  <h3 className="blog-preview-title">{previewPost.title}</h3>
                  <p className="blog-preview-excerpt">{previewPost.excerpt}</p>
                  <div className="blog-preview-meta">
                    <span>{previewPost.authorName}</span>
                    <span>{previewPost.isPublished ? formatDate(previewPost.publishedAt) : 'Noch nicht veröffentlicht'}</span>
                  </div>
                  <div className="blog-preview-content">
                    {renderContentPreview(previewPost.content)}
                  </div>
                </div>
              ) : (
                <div className="blog-preview-shell">
                  <h3 className="blog-preview-title">Neue Beiträge entstehen hier</h3>
                  <p className="blog-preview-excerpt">
                    Nach dem ersten Speichern kannst du im Editor schreiben, überarbeiten und danach gezielt veröffentlichen.
                  </p>
                  <div className="blog-preview-content">
                    <p>Die Vorschau hilft dir, Struktur und Lesefluss kurz zu prüfen, ohne den öffentlichen Blog öffnen zu müssen.</p>
                  </div>
                </div>
              )}
            </article>

            <article className="settings-status-card blog-cms-note">
              <div className="settings-status-card__eyebrow">Workflow</div>
              <strong>Redaktion statt Formularwüste</strong>
              <p>Links organisierst du Beiträge, rechts schreibst du fokussiert. Veröffentlichung bleibt eine bewusste zweite Entscheidung.</p>
              <p>Live-Beiträge öffnen direkt auf <span>my-revio.de/blog</span>.</p>
            </article>
          </aside>
        </div>
      </section>
    </PageShell>
  );
}
