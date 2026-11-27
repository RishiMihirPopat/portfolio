'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { MotionConfig, motion } from 'motion/react';
import {
  background,
  caustics,
  drift,
  swell,
  type BackgroundHandle,
  type BackgroundPreset,
} from 'asciify-engine/kit';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_STORAGE_KEY,
  AnimatedAsciiSceneId,
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

const PRESET_MAP: Record<AnimatedAsciiSceneId, BackgroundPreset> = {
  swell,
  drift,
  caustics,
};

const PRESET_TUNING: Record<
  AnimatedAsciiSceneId,
  { cellSize: number; speed: number; darkOpacity: number; lightOpacity: number }
> = {
  swell: { cellSize: 10, speed: 0.72, darkOpacity: 0.76, lightOpacity: 0.94 },
  drift: { cellSize: 10, speed: 0.68, darkOpacity: 0.74, lightOpacity: 0.94 },
  caustics: { cellSize: 10, speed: 0.7, darkOpacity: 0.7, lightOpacity: 0.92 },
};

// Deepened coastal slate-teal in light mode (#153c4c) for crisp visibility over #e6ebe8
const ASCII_PALETTE = {
  dark: '#7cb1c6',
  light: '#153c4c',
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

const CLEAR_TARGET_SELECTOR =
  '[data-ascii-panel="true"], [data-ascii-header="true"], [data-ascii-footer="true"]';

function collectClearTargets(): Element[] {
  return Array.from(document.querySelectorAll(CLEAR_TARGET_SELECTOR));
}

function measureClearRects(targets: Element[]): ClearRect[] {
  const rects: ClearRect[] = [];
  const vw = window.innerWidth || document.documentElement.clientWidth || 1200;
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;

  for (let i = 0; i < targets.length; i++) {
    const el = targets[i];
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    // Clamp to the visible viewport before inverting Y so tall panels
    // (such as full-length blog articles) never produce negative top offsets
    const left = Math.max(0, r.left);
    const right = Math.min(vw, r.right);
    const top = Math.max(0, r.top);
    const bottom = Math.min(vh, r.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width > 8 && height > 6) {
      rects.push({
        left,
        // asciify-engine@4.33.0 uploads clearMap with inverted Y relative to screen coordinates
        top: vh - bottom,
        width,
        height,
      });
    }
  }

  return rects;
}

export function AsciiBeachCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<BackgroundHandle | null>(null);
  const targetsRef = useRef<Element[]>([]);
  const activeSceneRef = useRef<AsciiSceneId>(DEFAULT_ASCII_SCENE);
  const lastAnimatedRef = useRef<AnimatedAsciiSceneId>('swell');
  const resolvedThemeRef = useRef<string | undefined>('dark');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    resolvedThemeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initialScene = readPersistedScene();
    activeSceneRef.current = initialScene;
    if (initialScene !== 'still') {
      lastAnimatedRef.current = initialScene;
    }
    targetsRef.current = collectClearTargets();

    // Called synchronously inside asciify-engine's own render tick right before WebGL draw,
    // avoiding extra RAF hops and scroll-time lag. asciify-engine skips texture upload whenever
    // the returned coordinates are unchanged.
    const readLiveClearRects = (): ClearRect[] =>
      measureClearRects(targetsRef.current);

    const resolveEffectivePreset = (scene: AsciiSceneId): AnimatedAsciiSceneId =>
      scene === 'still' ? lastAnimatedRef.current : scene;

    const isPaused = (scene: AsciiSceneId) =>
      scene === 'still' || motionQuery.matches;

    const getThemeIsLight = () =>
      resolvedThemeRef.current === 'light' ||
      document.documentElement.classList.contains('light');

    const getThemePalette = () =>
      getThemeIsLight() ? ASCII_PALETTE.light : ASCII_PALETTE.dark;

    const getOpacityForPreset = (presetId: AnimatedAsciiSceneId) => {
      const tuning = PRESET_TUNING[presetId];
      return getThemeIsLight() ? tuning.lightOpacity : tuning.darkOpacity;
    };

    const initialPresetId = resolveEffectivePreset(initialScene);
    const initialTuning = PRESET_TUNING[initialPresetId];
    const handle = background(host, {
      preset: PRESET_MAP[initialPresetId],
      palette: getThemePalette(),
      mark: 'glyph',
      charset: ' .,:;-=+*#%@',
      cursor: false,
      cellSize: initialTuning.cellSize,
      speed: isPaused(initialScene) ? 0 : initialTuning.speed,
      opacity: getOpacityForPreset(initialPresetId),
      clear: readLiveClearRects,
      // Tighter halo around page content so ASCII glyphs sit closely without overlapping text
      clearPadding: 6,
      clearSoftness: 12,
      clearStrength: 0.96,
      lazy: false,
    });
    handleRef.current = handle;

    let rafNudge: number | null = null;
    let settleTimer: number | null = null;
    const nudgeEngineRedraw = () => {
      if (rafNudge !== null) return;
      rafNudge = requestAnimationFrame(() => {
        rafNudge = null;
        // Ensures paused/still mode and freshly mounted panels refresh their clearMap
        handle.update({});
      });
    };

    const scheduleSettledNudge = () => {
      nudgeEngineRedraw();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        nudgeEngineRedraw();
      }, 380);
    };

    const resizeObserver = new ResizeObserver(nudgeEngineRedraw);
    const observeClearTargets = () => {
      resizeObserver.disconnect();
      const nextTargets = collectClearTargets();
      targetsRef.current = nextTargets;
      for (let i = 0; i < nextTargets.length; i++) {
        resizeObserver.observe(nextTargets[i]);
      }
      scheduleSettledNudge();
    };

    observeClearTargets();
    const mutationObserver = new MutationObserver(observeClearTargets);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const syncEngineState = (scene: AsciiSceneId, switchPreset: boolean) => {
      const presetId = resolveEffectivePreset(scene);
      const nextTuning = PRESET_TUNING[presetId];
      if (switchPreset) {
        handle.setPreset(PRESET_MAP[presetId]);
      }
      handle.update({
        palette: getThemePalette(),
        cursor: false,
        mark: 'glyph',
        charset: ' .,:;-=+*#%@',
        cellSize: nextTuning.cellSize,
        speed: isPaused(scene) ? 0 : nextTuning.speed,
        opacity: getOpacityForPreset(presetId),
        clearPadding: 6,
        clearSoftness: 12,
        clearStrength: 0.96,
      });
    };

    const applyScene = (nextId: AsciiSceneId) => {
      if (nextId === activeSceneRef.current) return;
      const prevPreset = resolveEffectivePreset(activeSceneRef.current);
      activeSceneRef.current = nextId;
      if (nextId !== 'still') {
        lastAnimatedRef.current = nextId;
      }
      try {
        window.localStorage.setItem(ASCII_SCENE_STORAGE_KEY, nextId);
      } catch {
        // Ignore storage errors
      }
      const nextPreset = resolveEffectivePreset(nextId);
      syncEngineState(nextId, nextPreset !== prevPreset);
    };

    const onReducedMotionChange = () => {
      syncEngineState(activeSceneRef.current, false);
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

    motionQuery.addEventListener('change', onReducedMotionChange);
    window.addEventListener('resize', nudgeEngineRedraw, { passive: true });
    window.addEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
    window.addEventListener('storage', onStorage);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(nudgeEngineRedraw);
    }

    return () => {
      if (rafNudge !== null) cancelAnimationFrame(rafNudge);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      motionQuery.removeEventListener('change', onReducedMotionChange);
      window.removeEventListener('resize', nudgeEngineRedraw);
      window.removeEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
      window.removeEventListener('storage', onStorage);
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // Re-sync Asciify ink palette and opacity whenever light/dark theme toggles
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const presetId =
      activeSceneRef.current === 'still'
        ? lastAnimatedRef.current
        : activeSceneRef.current;
    const tuning = PRESET_TUNING[presetId];
    const isLight =
      resolvedTheme === 'light' ||
      (resolvedTheme === undefined &&
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('light'));
    handle.update({
      palette: isLight ? ASCII_PALETTE.light : ASCII_PALETTE.dark,
      opacity: isLight ? tuning.lightOpacity : tuning.darkOpacity,
      cursor: false,
    });
  }, [resolvedTheme]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={hostRef}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.48, ease: CALM_EASE }}
        className="fixed inset-0 w-screen h-[100lvh] pointer-events-none z-0 overflow-hidden transition-opacity duration-300"
      />
    </MotionConfig>
  );
}
