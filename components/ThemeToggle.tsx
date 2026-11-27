'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';

function subscribeEmpty(): () => void {
  return () => {};
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );

  if (!mounted) {
    return <span className="inline-flex w-11 h-11 min-w-[44px] min-h-[44px] shrink-0" />;
  }

  const isLight = resolvedTheme === 'light';

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        whileHover={{ y: -0.5 }}
        whileTap={{ scale: 0.92 }}
        transition={TACTILE_SPRING}
        className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2 text-ink-nav hover:text-ink transition-colors cursor-pointer inline-flex items-center justify-center shrink-0 overflow-hidden"
        aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isLight ? 'moon' : 'sun'}
            initial={{ opacity: 0, rotate: -30, scale: 0.75 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.75 }}
            transition={{ duration: 0.18, ease: CALM_EASE }}
            className="inline-flex items-center justify-center"
          >
            {isLight ? (
              <Moon size={15} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Sun size={15} strokeWidth={1.75} aria-hidden="true" />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </MotionConfig>
  );
}
