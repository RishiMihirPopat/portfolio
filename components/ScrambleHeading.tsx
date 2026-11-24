'use client';

import { useEffect, useState } from 'react';

interface ScrambleHeadingProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2';
}

const SCRAMBLE_GLYPHS = '.:;-=+*#/_~';
const SCRAMBLE_DURATION_MS = 340;
const GLYPH_STEP_MS = 34;

function scrambleString(target: string, revealedCount: number, tick: number): string {
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (i < revealedCount || ch === ' ' || ch === '\u00a0') {
      out += ch;
    } else {
      const idx = (i * 7 + tick * 3) % SCRAMBLE_GLYPHS.length;
      out += SCRAMBLE_GLYPHS[idx];
    }
  }
  return out;
}

export function ScrambleHeading({
  text,
  className = '',
  as: Tag = 'h1',
}: ScrambleHeadingProps) {
  const [scrambleState, setScrambleState] = useState<{
    target: string;
    value: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || text.length === 0) {
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    let lastStepTick = -1;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / SCRAMBLE_DURATION_MS);

      if (progress >= 1) {
        setScrambleState(null);
        return;
      }

      const eased = 1 - Math.pow(1 - progress, 2);
      const revealedCount = Math.floor(eased * text.length);
      const tick = Math.floor(elapsed / GLYPH_STEP_MS);

      if (tick !== lastStepTick) {
        lastStepTick = tick;
        setScrambleState({
          target: text,
          value: scrambleString(text, revealedCount, tick),
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [text]);

  const displayText =
    scrambleState && scrambleState.target === text ? scrambleState.value : text;

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">{displayText}</span>
    </Tag>
  );
}
