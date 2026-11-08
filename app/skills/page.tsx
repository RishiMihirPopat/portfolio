import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Skills',
};

export default function SkillsPage() {
  return <PortfolioSectionView section="skills" />;
}
