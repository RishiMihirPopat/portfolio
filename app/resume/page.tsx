import type { Metadata } from 'next';
import { ResumeSection } from '@/components/sections/ResumeSection';

export const metadata: Metadata = {
  title: 'Résumé',
  description:
    'Work experience, academic background, and technical methods for Rishi Mihir Popat (MSc Data Science, Manipal Academy of Higher Education).',
  alternates: {
    canonical: '/resume/',
  },
};

export default function ResumePage() {
  return <ResumeSection />;
}
