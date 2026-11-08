import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Education',
};

export default function EducationPage() {
  return <PortfolioSectionView section="academics" />;
}
