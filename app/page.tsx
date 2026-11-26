import type { Metadata } from 'next';
import { HomeSection } from '@/components/sections/HomeSection';

export const metadata: Metadata = {
  description:
    'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education. Statistical modeling, Bayesian computation, deep learning, and field photography.',
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return <HomeSection />;
}
