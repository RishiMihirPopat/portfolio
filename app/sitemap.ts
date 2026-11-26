import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://rishipopat.site'
).replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'monthly' },
    { path: '/projects/', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/photography/', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/blog/', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/resume/', priority: 0.8, changeFrequency: 'monthly' },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
