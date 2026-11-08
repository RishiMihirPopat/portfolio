import type { Metadata } from 'next';
import { PortfolioSectionView } from '@/components/PortfolioSectionView';

export const metadata: Metadata = {
  title: 'Resume',
};

export default function ResumePage() {
  return <PortfolioSectionView section="resume" />;
}
