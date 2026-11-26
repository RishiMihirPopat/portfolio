import type { Metadata } from 'next';
import { PhotographySection } from '@/components/sections/PhotographySection';

export const metadata: Metadata = {
  title: 'Photography',
  description:
    'Curated field photography series and EXIF archive by Rishi Mihir Popat.',
  alternates: {
    canonical: '/photography/',
  },
};

export default function PhotographyPage() {
  return <PhotographySection />;
}
