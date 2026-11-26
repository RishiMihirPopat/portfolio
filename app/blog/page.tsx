import type { Metadata } from 'next';
import { BlogSection } from '@/components/sections/BlogSection';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Research notes and technical writing on statistical modeling, Bayesian computation, and machine learning by Rishi Mihir Popat.',
  alternates: {
    canonical: '/blog/',
  },
};

export default function BlogPage() {
  return <BlogSection />;
}
