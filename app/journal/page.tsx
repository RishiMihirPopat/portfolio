import type { Metadata } from 'next';
import { BlogSection } from '@/components/sections/BlogSection';

export const metadata: Metadata = {
  title: 'Blog',
  alternates: {
    canonical: '/blog/',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function JournalPage() {
  return <BlogSection />;
}
