import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Blog',
};

export default function JournalPage() {
  return <PortfolioSectionView section="blog" />;
}
