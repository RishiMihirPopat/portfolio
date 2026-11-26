import { profileData } from '@/lib/data';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://rishipopat.site'
).replace(/\/$/, '');

export function JsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'Rishi Popat',
        description:
          'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education.',
        inLanguage: 'en-US',
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#person`,
        name: profileData.name,
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/og.png`,
        jobTitle: 'MSc Data Science Student',
        affiliation: {
          '@type': 'CollegeOrUniversity',
          name: 'Manipal Academy of Higher Education',
        },
        sameAs: [profileData.github].filter(Boolean),
      },
    ],
  };

  // Escape `<` so embedded JSON-LD can never break out of the script element
  const serialized = JSON.stringify(graph).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
}
