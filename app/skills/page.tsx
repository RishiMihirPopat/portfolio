import type { Metadata } from 'next';
import { ResumeSection } from '@/components/sections/ResumeSection';

export const metadata: Metadata = {
  title: 'Skills',
  alternates: {
    canonical: '/resume/',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SkillsPage() {
  return <ResumeSection />;
}
