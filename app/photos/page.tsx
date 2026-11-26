import type { Metadata } from 'next';
import { PhotographySection } from '@/components/sections/PhotographySection';

export const metadata: Metadata = {
  title: 'Photography',
  alternates: {
    canonical: '/photography/',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PhotosPage() {
  return <PhotographySection />;
}
