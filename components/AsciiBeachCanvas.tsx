'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { MotionConfig, motion } from 'motion/react';
import {
  background,
  caustics,
  contour,
  swell,
  type BackgroundHandle,
  type BackgroundPreset,
} from 'asciify-engine/kit';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_STORAGE_KEY,
  AsciiSceneId,
  DEFAULT_ASCII_SCENE,
  normalizeAsciiSceneId,
} from './ascii/types';

export type BeachSectionId =
  | 'home'
  | 'projects'
  | 'resume'
  | 'photography'
  | 'blog'
  | 'experience'
  | 'academics'
  | 'skills';

export const FADE_OUT_MS = 220;
export const FADE_IN_MS = 320;
export const NON_BEACH_FADE_OUT_MS = FADE_OUT_MS;
export const FADE_DURATION_MS = FADE_IN_MS;

const CALM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const PRESET_MAP: Record<AsciiSceneId, BackgroundPreset> = {
  swell,
  contour,
  caustics,
};

const PRESET_TUNING: Record<
  AsciiSceneId,
  { cellSize: number; speed: number; opacity: number }
> = {
  swell: { cellSize: 10, speed: 0.72, opacity: 0.74 },
  contour: { cellSize: 10, speed: 0.65, opacity: 0.68 },
  caustics: { cellSize: 10, speed: 0.7, opacity: 0.66 },
};

const ASCII_PALETTE = {
  dark: '#7cb1c6',
  light: '#295b6c',
};

interface ClearRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readPersistedScene(): AsciiSceneId {
  if (typeof window === 'undefined') return DEFAULT_ASCII_SCENE;
  try {
    return normalizeAsciiSceneId(
      window.localStorage.getItem(ASCII_SCENE_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_ASCII_SCENE;
  }
}

function measureClearRects(): ClearRect[] {
  const rects: ClearRect[] = [];
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  const selectors = [
    '[data-ascii-panel="true"]',
    '[data-ascii-header="true"]',
    '[data-ascii-footer="true"]',
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 6) {
        rects.push({
          left: r.left,
          // asciify-engine@4.33.0 uploads clearMap with inverted Y relative to screen coordinates
          top: vh - r.bottom,
          width: r.width,
          height: r.height,
        });
      }
    });
  }

  return rects;
}

export function AsciiBeachCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<BackgroundHandle | null>(null);
  const clearRectsRef = useRef<ClearRect[]>([]);
  const activeSceneRef = useRef<AsciiSceneId>(DEFAULT_ASCII_SCENE);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const initialScene = readPersistedScene();
    activeSceneRef.current = initialScene;
    clearRectsRef.current = measureClearRects();

    const tuning = PRESET_TUNING[initialScene];
    const handle = background(host, {
      preset: PRESET_MAP[initialScene],
      palette: ASCII_PALETTE,
      mark: 'glyph',
      charset: ' .,:;-=+*#%@',
      cursor: false,
      cellSize: tuning.cellSize,
      speed: tuning.speed,
      opacity: tuning.opacity,
      clear: () => clearRectsRef.current,
      clearPadding: 28,
      clearSoftness: 34,
      clearStrength: 1,
      lazy: false,
    });
    handleRef.current = handle;

    let rafMeasure: number | null = null;
    const scheduleMeasure = () => {
      if (rafMeasure !== null) return;
      rafMeasure = requestAnimationFrame(() => {
        rafMeasure = null;
        clearRectsRef.current = measureClearRects();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const observeClearTargets = () => {
      resizeObserver.disconnect();
      document
        .querySelectorAll(
          '[data-ascii-panel="true"], [data-ascii-header="true"], [data-ascii-footer="true"]'
        )
        .forEach((el) => resizeObserver.observe(el));
      scheduleMeasure();
    };

    observeClearTargets();
    const mutationObserver = new MutationObserver(observeClearTargets);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const applyScene = (nextId: AsciiSceneId) => {
      if (nextId === activeSceneRef.current) return;
      activeSceneRef.current = nextId;
      try {
        window.localStorage.setItem(ASCII_SCENE_STORAGE_KEY, nextId);
      } catch {
        // Ignore storage errors
      }
      const nextTuning = PRESET_TUNING[nextId];
      handle.setPreset(PRESET_MAP[nextId]);
      handle.update({
        cursor: false,
        mark: 'glyph',
        charset: ' .,:;-=+*#%@',
        cellSize: nextTuning.cellSize,
        speed: nextTuning.speed,
        opacity: nextTuning.opacity,
      });
    };

    const onSceneChange = (e: Event) => {
      const custom = e as CustomEvent<{ scene?: string } | string>;
      const raw =
        typeof custom.detail === 'string' ? custom.detail : custom.detail?.scene;
      if (raw) {
        applyScene(normalizeAsciiSceneId(raw));
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === ASCII_SCENE_STORAGE_KEY && e.newValue) {
        applyScene(normalizeAsciiSceneId(e.newValue));
      }
    };

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
    window.addEventListener('storage', onStorage);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMeasure);
    }

    return () => {
      if (rafMeasure !== null) cancelAnimationFrame(rafMeasure);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
      window.removeEventListener('storage', onStorage);
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // Re-sync Asciify ink palette whenever light/dark theme toggles
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.update({ palette: ASCII_PALETTE, cursor: false });
  }, [resolvedTheme]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={hostRef}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.48, ease: CALM_EASE }}
        className="fixed inset-0 w-screen h-[100lvh] pointer-events-none z-0 overflow-hidden"
      />
    </MotionConfig>
  );
}
