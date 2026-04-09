import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedBlogPost, getPublishedBlogPosts } from '../../../lib/blog';
import { ReadingProgress } from '../../../components/reading-progress';
import { BlogToc, type TocEntry } from '../../../components/blog-toc';

function formatDate(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="blog-inline-code">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

function extractToc(content: string): TocEntry[] {
  return content
    .split('\n')
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      const text = line.replace(/^##\s+/, '').trim();
      return { id: slugify(text), text };
    });
}

function renderContent(content: string): ReactNode[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    // h2
    if (lines.length === 1 && lines[0].startsWith('## ')) {
      const text = lines[0].replace(/^##\s+/, '');
      return <h2 key={i} id={slugify(text)}>{text}</h2>;
    }

    // h3
    if (lines.length === 1 && lines[0].startsWith('### ')) {
      const text = lines[0].replace(/^###\s+/, '');
      return <h3 key={i}>{text}</h3>;
    }

    // horizontal rule
    if (lines.length === 1 && /^---+$/.test(lines[0])) {
      return <hr key={i} className="blog-divider" />;
    }

    // blockquote → info callout
    if (lines.every((l) => l.startsWith('> '))) {
      return (
        <div key={i} className="blog-infobox">
          {lines.map((l, j) => (
            <p key={j}>{renderInline(l.replace(/^>\s+/, ''))}</p>
          ))}
        </div>
      );
    }

    // unordered list
    if (lines.every((l) => /^[-*]\s/.test(l))) {
      return (
        <ul key={i} className="blog-article__list">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    // ordered list
    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      return (
        <ol key={i} className="blog-article__olist">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      );
    }

    // paragraph
    return <p key={i}>{renderInline(lines.join(' '))}</p>;
  });
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://my-revio.de';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);

  if (!post) {
    return {
      title: 'Beitrag nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const url = `${SITE_URL}/blog/${slug}`;
  const publishedTime = post.publishedAt ?? post.createdAt;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.excerpt,
      publishedTime,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
      locale: 'de_DE',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

export async function generateStaticParams() {
  const posts = await getPublishedBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

function buildJsonLd(post: Awaited<ReturnType<typeof getPublishedBlogPost>>) {
  if (!post) return null;

  const url = `${SITE_URL}/blog/${post.slug}`;
  const publishedTime = post.publishedAt ?? post.createdAt;

  // Extract FAQ entries: lines starting with "?? " become questions,
  // the next paragraph becomes the answer.
  const faqEntries: { question: string; answer: string }[] = [];
  const blocks = post.content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (let i = 0; i < blocks.length - 1; i++) {
    if (blocks[i].startsWith('?? ')) {
      faqEntries.push({
        question: blocks[i].replace(/^\?\?\s+/, ''),
        answer: blocks[i + 1].replace(/^[-*>]\s*/gm, '').replace(/\*\*/g, ''),
      });
    }
  }

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    url,
    datePublished: publishedTime,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Revio',
      url: SITE_URL,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    inLanguage: 'de-DE',
  };

  if (faqEntries.length === 0) return [blogPosting];

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return [blogPosting, faqPage];
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  const toc = extractToc(post.content);
  const jsonLd = buildJsonLd(post);

  return (
    <>
      {jsonLd?.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ReadingProgress />
      <section className="blog-article">
        <div className="shell blog-article__shell">
          <Link href="/blog" className="page-back-link blog-article__back">← Zurück zum Blog</Link>

          <header className="blog-article__header">
            <div className="eyebrow">Blog</div>
            <h1 className="blog-article__title">{post.title}</h1>
            <p className="blog-article__lead">{post.excerpt}</p>
            <div className="blog-article__meta">
              <span className="blog-article__author">{post.authorName}</span>
              <span className="blog-article__dot" aria-hidden="true">·</span>
              <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
            </div>
          </header>

          <BlogToc entries={toc} />

          <article className="blog-article__body">
            {renderContent(post.content)}
          </article>

          <div className="blog-article__cta">
            <div className="blog-cta-card">
              <p className="eyebrow">Für Therapeuten</p>
              <h3 className="blog-cta-card__heading">Revio — Ihre Praxis, digital gefunden.</h3>
              <p className="blog-cta-card__body">Erstellen Sie in wenigen Minuten Ihr kostenloses Profil und lassen Sie sich von Patienten in Ihrer Region entdecken.</p>
              <div className="blog-cta-card__actions">
                <Link href="/therapists" className="button button--primary">
                  Jetzt registrieren
                </Link>
                <Link href="/therapists" className="button button--ghost">
                  Mehr erfahren
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
