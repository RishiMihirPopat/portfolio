import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Photography',
};

export default function PhotographyPage() {
  return <PortfolioSectionView section="photography" />;
}
