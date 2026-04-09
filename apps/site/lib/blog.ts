import { getSiteApiBaseCandidates } from './api-base';

export type PublicBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Revalidate blog content every hour. Adjust to taste.
const BLOG_REVALIDATE = 3600;

export async function getPublishedBlogPosts(): Promise<PublicBlogPost[]> {
  for (const base of getSiteApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}/config/blog-posts`, {
        next: { revalidate: BLOG_REVALIDATE },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { posts: PublicBlogPost[] };
      return data.posts;
    } catch {
      continue;
    }
  }

  return [];
}

export async function getPublishedBlogPost(slug: string): Promise<PublicBlogPost | null> {
  for (const base of getSiteApiBaseCandidates()) {
    try {
      const res = await fetch(`${base}/config/blog-posts/${slug}`, {
        next: { revalidate: BLOG_REVALIDATE },
      });
      if (res.status === 404) return null;
      if (!res.ok) continue;
      const data = (await res.json()) as { post: PublicBlogPost };
      return data.post;
    } catch {
      continue;
    }
  }

  return null;
}
