'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const LEGACY_HASH_MAP: Record<string, string> = {
  projects: '/projects',
  work: '/resume',
  experience: '/resume',
  education: '/resume',
  academics: '/resume',
  skills: '/resume',
  photography: '/photography',
  photos: '/photography',
  blog: '/blog',
  journal: '/blog',
  resume: '/resume',
};

export function HomeSection() {
  const router = useRouter();

  // Support legacy hash URLs (/#projects, /#work, etc.) by redirecting to real routes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (hash && LEGACY_HASH_MAP[hash]) {
      router.replace(LEGACY_HASH_MAP[hash]);
    }
  }, [router]);

  return (
    <div
      data-ascii-panel="true"
      className="w-fit max-w-[540px] space-y-2 pt-2 sm:pt-4"
    >
      <ScrambleHeading
        text="Rishi Mihir Popat"
        className="font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink"
      />
      <p className="section-content-reveal font-sans text-sm sm:text-base text-ink-nav leading-relaxed">
        MSc Data Science at Manipal Academy of Higher Education — statistical modeling, Bayesian computation, and deep learning.
      </p>
    </div>
  );
}
