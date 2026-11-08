import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Photography',
};

export default function PhotosPage() {
  return <PortfolioSectionView section="photography" />;
}
