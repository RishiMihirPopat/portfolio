import type { Metadata } from 'next';
import { ResumeSection } from '@/components/sections/ResumeSection';

export const metadata: Metadata = {
  title: 'Education',
  alternates: {
    canonical: '/resume/',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function EducationPage() {
  return <ResumeSection />;
}
