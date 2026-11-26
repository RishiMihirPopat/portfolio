import type { Metadata } from 'next';
import { ProjectsSection } from '@/components/sections/ProjectsSection';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Selected data science, machine learning, and software engineering projects by Rishi Mihir Popat.',
  alternates: {
    canonical: '/projects/',
  },
};

export default function ProjectsPage() {
  return <ProjectsSection />;
}
