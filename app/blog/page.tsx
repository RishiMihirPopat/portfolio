import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Blog',
};

export default function BlogPage() {
  return <PortfolioSectionView section="blog" />;
}
