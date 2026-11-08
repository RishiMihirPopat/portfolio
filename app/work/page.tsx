import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Work',
};

export default function WorkPage() {
  return <PortfolioSectionView section="experience" />;
}
