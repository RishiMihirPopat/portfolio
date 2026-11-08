import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Projects',
};

export default function ProjectsPage() {
  return <PortfolioSectionView section="projects" />;
}
