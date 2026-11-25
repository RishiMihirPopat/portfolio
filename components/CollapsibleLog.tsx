'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, type Transition, type Variants } from 'motion/react';

export const CALM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const WAVE_EXIT_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export const TACTILE_SPRING: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 34,
  mass: 0.7,
};

export const GLIDE_SPRING: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 38,
  mass: 0.75,
};

export const ACCORDION_TRANSITION: Transition = {
  height: { duration: 0.28, ease: CALM_EASE },
  opacity: { duration: 0.2, ease: CALM_EASE },
};

export const PANEL_VIEW_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 6,
    filter: 'blur(0px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.38,
      ease: CALM_EASE,
      when: 'beforeChildren',
      staggerChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    filter: 'blur(3px)',
    transition: {
      duration: 0.5,
      ease: WAVE_EXIT_EASE,
    },
  },
};

export const SECTION_ITEM_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: CALM_EASE,
    },
  },
};

interface CollapsibleLogProps {
  id: string;
  label: string;
  logs: string[];
  maxHeightClass?: string;
  children?: React.ReactNode;
}

export function CollapsibleLog({
  id,
  label,
  logs,
  maxHeightClass = 'max-h-36',
  children,
}: CollapsibleLogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `${id}-panel`;
  const buttonId = `${id}-toggle`;

  return (
    <div className="border-t border-line pt-3">
      <motion.button
        id={buttonId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
        whileTap={{ scale: 0.99 }}
        transition={TACTILE_SPRING}
        className="group font-mono text-xs text-ink-muted hover:text-ink transition-colors cursor-pointer select-none inline-flex items-center gap-1.5 py-1 min-h-[32px]"
      >
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 440, damping: 30 }}
          className="inline-flex items-center justify-center text-ink-muted group-hover:text-ink"
        >
          <ChevronRight size={13} />
        </motion.span>
        <span>{label}</span>
        <span className="inline-flex items-center text-ink-muted/85">
          (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={logs.length}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16, ease: CALM_EASE }}
              className="inline-block tabular-nums"
            >
              {logs.length}
            </motion.span>
          </AnimatePresence>
          )
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={ACCORDION_TRANSITION}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-3 font-mono text-xs">
              {children}
              <div className={`space-y-1 text-[11px] text-ink-muted ${maxHeightClass} overflow-y-auto pr-1`}>
                <AnimatePresence initial={false}>
                  {logs.map((log, i) => (
                    <motion.div
                      key={`${i}-${log}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, ease: CALM_EASE }}
                      className="leading-relaxed"
                    >
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
