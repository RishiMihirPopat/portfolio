'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MotionConfig, motion } from 'motion/react';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { CALM_EASE } from '@/components/CollapsibleLog';

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
    <MotionConfig reducedMotion="user">
      <motion.div
        data-ascii-panel="true"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: CALM_EASE }}
        className="w-fit max-w-[500px] space-y-2 mt-2 sm:mt-4"
      >
        <ScrambleHeading
          text="Rishi Mihir Popat"
          className="font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink"
        />
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.06, ease: CALM_EASE }}
          className="section-content-reveal font-sans text-sm sm:text-base text-ink-nav leading-relaxed"
        >
          MSc Data Science at Manipal Academy of Higher Education — statistical modeling, Bayesian computation, and deep learning.
        </motion.p>
      </motion.div>
    </MotionConfig>
  );
}
