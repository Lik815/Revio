import type { MetadataRoute } from 'next';
import { getPublishedBlogPosts } from '../lib/blog';
import { getCitiesWithListings } from '../lib/public-api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://my-revio.de';

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    changeFrequency: 'weekly',
    priority: 1.0,
  },
  {
    url: `${SITE_URL}/finden`,
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/patients`,
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/therapists`,
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/about`,
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    url: `${SITE_URL}/contact`,
    changeFrequency: 'yearly',
    priority: 0.5,
  },
  {
    url: `${SITE_URL}/blog`,
    changeFrequency: 'weekly',
    priority: 0.8,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, cities] = await Promise.all([getPublishedBlogPosts(), getCitiesWithListings()]);

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // Directory-First-Refactor (R7): eine Stadtseite pro Stadt mit echten Einträgen.
  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${SITE_URL}/physiotherapie/${encodeURIComponent(city)}`,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  return [...STATIC_ROUTES, ...blogRoutes, ...cityRoutes];
}
