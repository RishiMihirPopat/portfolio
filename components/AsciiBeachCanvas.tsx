'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { beachScene, type BeachSceneParams } from './ascii/beachScene';
import { cityScene } from './ascii/cityScene';
import { cozyRoomScene } from './ascii/cozyRoomScene';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_STORAGE_KEY,
  AsciiScene,
  AsciiSceneId,
  DEFAULT_ASCII_RAMP,
  DEFAULT_ASCII_SCENE,
  MAX_SCENE_TIERS,
  SceneCellBuffers,
  SceneFrameContext,
  SceneViewport,
  SceneWashTheme,
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

export type SceneParams = BeachSceneParams;

export const WASH_DURATION_MS = 560;
export const NON_BEACH_FADE_OUT_MS = 260;
export const FADE_DURATION_MS = 460;
export const SCENE_SWITCH_DURATION_MS = 520;

const SCENE_REGISTRY: Record<AsciiSceneId, AsciiScene> = {
  beach: beachScene,
  city: cityScene,
  room: cozyRoomScene,
};

function isValidSceneId(value: string | null | undefined): value is AsciiSceneId {
  return value === 'beach' || value === 'city' || value === 'room';
}

function readPersistedScene(): AsciiSceneId {
  if (typeof window === 'undefined') return DEFAULT_ASCII_SCENE;
  try {
    const stored = window.localStorage.getItem(ASCII_SCENE_STORAGE_KEY);
    return isValidSceneId(stored) ? stored : DEFAULT_ASCII_SCENE;
  } catch {
    return DEFAULT_ASCII_SCENE;
  }
}

// Fast permutation table for organic panel feathering & wash mist
const PERM = new Uint8Array(512);
const VALS = new Float32Array(256);
(() => {
  let seed = 918273645;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    VALS[i] = (seed & 0xffff) / 0xffff;
  }
  for (let i = 255; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
  }
})();

function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const X = xi & 255;
  const Y = yi & 255;

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const aa = PERM[PERM[X] + Y];
  const ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];

  const x1 = VALS[aa] + u * (VALS[ba] - VALS[aa]);
  const x2 = VALS[ab] + u * (VALS[bb] - VALS[ab]);

  return x1 + v * (x2 - x1);
}

function fastHash(c: number, r: number): number {
  let n = (Math.imul(c, 374761393) + Math.imul(r, 668265263)) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function sdRoundedBox(
  px: number,
  py: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number
): number {
  const cx = (left + right) * 0.5;
  const cy = (top + bottom) * 0.5;
  const hx = Math.max(0, (right - left) * 0.5 - radius);
  const hy = Math.max(0, (bottom - top) * 0.5 - radius);
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;
  const outDist = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inDist = Math.min(Math.max(dx, dy), 0);
  return outDist + inDist - radius;
}

function createBuffers(size: number): SceneCellBuffers {
  return {
    lumas: new Float32Array(size),
    tiers: new Uint8Array(size),
    charCodes: new Uint16Array(size),
  };
}

function clearBuffers(buf: SceneCellBuffers): void {
  buf.lumas.fill(0);
  buf.tiers.fill(0);
  buf.charCodes.fill(0);
}

const DEFAULT_CREST_CHARS = '*#%@';
const DEFAULT_WAKE_CHARS = '.:;-~=+*';
const SWITCH_SHIMMER_CHARS = '~-=+*#%';

function defaultWashTheme(isLight: boolean): SceneWashTheme {
  if (isLight) {
    return {
      troughColor: 'hsla(210, 32%, 22%, 0.78)',
      wakeColor: 'hsla(205, 28%, 34%, 0.68)',
      crestColor: 'hsla(42, 45%, 96%, 0.96)',
    };
  }
  return {
    troughColor: 'hsla(212, 36%, 44%, 0.52)',
    wakeColor: 'hsla(204, 34%, 76%, 0.78)',
    crestColor: 'hsla(46, 36%, 95%, 0.96)',
  };
}

export function AsciiBeachCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const resolvedThemeRef = useRef<string | undefined>(resolvedTheme);

  const isHomeRef = useRef<boolean>(true);
  const lastPathRef = useRef<string | null>(null);
  const reducedMotionRef = useRef<boolean>(false);

  const washStartRef = useRef<number>(-1);
  const fadeOutStartRef = useRef<number>(-1);
  const lastWashTriggerRef = useRef<number>(-9999);
  const isWashingOrSwappingRef = useRef<boolean>(false);
  const fadeStartRef = useRef<number>(-1);
  const snapPanelRef = useRef<boolean>(true);

  const activeSceneIdRef = useRef<AsciiSceneId>(DEFAULT_ASCII_SCENE);
  const prevSceneIdRef = useRef<AsciiSceneId | null>(null);
  const sceneSwitchStartRef = useRef<number>(-1);
  const drawNowRef = useRef<((now: number) => void) | null>(null);

  useEffect(() => {
    const clean = (pathname || '/').replace(/\/+$/, '') || '/';
    isHomeRef.current = clean === '/';

    if (lastPathRef.current !== null && lastPathRef.current !== clean) {
      const now = performance.now();
      const isBeach = activeSceneIdRef.current === 'beach';
      const exitDuration = isBeach ? WASH_DURATION_MS : NON_BEACH_FADE_OUT_MS;
      if (now - lastWashTriggerRef.current > exitDuration + 600) {
        if (!reducedMotionRef.current) {
          if (isBeach) {
            washStartRef.current = now;
            fadeOutStartRef.current = -1;
          } else {
            fadeOutStartRef.current = now;
            washStartRef.current = -1;
          }
          lastWashTriggerRef.current = now;
          isWashingOrSwappingRef.current = true;
          fadeStartRef.current = -1;
        }
      } else {
        washStartRef.current = -1;
        fadeOutStartRef.current = -1;
        isWashingOrSwappingRef.current = false;
        fadeStartRef.current = now;
        snapPanelRef.current = true;
      }
    }
    lastPathRef.current = clean;
  }, [pathname]);

  useEffect(() => {
    activeSceneIdRef.current = readPersistedScene();

    const applySceneChange = (nextId: AsciiSceneId) => {
      if (nextId === activeSceneIdRef.current) return;
      if (!reducedMotionRef.current) {
        prevSceneIdRef.current = activeSceneIdRef.current;
        sceneSwitchStartRef.current = performance.now();
      } else {
        prevSceneIdRef.current = null;
        sceneSwitchStartRef.current = -1;
      }
      activeSceneIdRef.current = nextId;
      try {
        window.localStorage.setItem(ASCII_SCENE_STORAGE_KEY, nextId);
      } catch {
        // Ignore storage errors
      }
      if (reducedMotionRef.current && drawNowRef.current) {
        drawNowRef.current(performance.now());
      }
    };

    const onWaveWash = () => {
      if (!reducedMotionRef.current) {
        const now = performance.now();
        if (activeSceneIdRef.current === 'beach') {
          washStartRef.current = now;
          fadeOutStartRef.current = -1;
        } else {
          fadeOutStartRef.current = now;
          washStartRef.current = -1;
        }
        lastWashTriggerRef.current = now;
        isWashingOrSwappingRef.current = true;
        fadeStartRef.current = -1;
      }
    };

    const onPageFadeIn = () => {
      washStartRef.current = -1;
      fadeOutStartRef.current = -1;
      isWashingOrSwappingRef.current = false;
      fadeStartRef.current = performance.now();
      snapPanelRef.current = true;
    };

    const onSceneChange = (e: Event) => {
      const custom = e as CustomEvent<{ scene?: string } | string>;
      const candidate =
        typeof custom.detail === 'string' ? custom.detail : custom.detail?.scene;
      if (isValidSceneId(candidate)) {
        applySceneChange(candidate);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === ASCII_SCENE_STORAGE_KEY && isValidSceneId(e.newValue)) {
        applySceneChange(e.newValue);
      }
    };

    window.addEventListener('ascii-wave-wash', onWaveWash);
    window.addEventListener('ascii-page-fade-in', onPageFadeIn);
    window.addEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ascii-wave-wash', onWaveWash);
      window.removeEventListener('ascii-page-fade-in', onPageFadeIn);
      window.removeEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    resolvedThemeRef.current = resolvedTheme;
    if (reducedMotionRef.current && drawNowRef.current) {
      drawNowRef.current(performance.now());
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;

    let rafId = 0;
    let isTabHidden = document.hidden;
    let lastFrameTime = 0;
    let prevDrawTime = performance.now();

    let fpsFrameCount = 0;
    let fpsWindowStart = performance.now();
    (window as unknown as Record<string, number>).__asciiFps = 30;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastSetupWidth = 0;
    let lastSetupHeight = 0;

    let fontSize = 8;
    let cellW = 4.8;
    let cellH = 8.5;
    let cols = 300;
    let rows = 106;
    let resolvedFontStr = '8px Consolas, "Courier New", monospace';

    let targetPointerX = 0;
    let targetPointerY = 0;
    let pointerX = 0;
    let pointerY = 0;

    let currBuffers = createBuffers(cols * rows);
    let prevBuffers: SceneCellBuffers | null = null;
    let washCrestCol = new Float32Array(cols);
    let bayArchTable = new Float32Array(cols);
    let rowOutChar = new Uint16Array(cols);
    let rowOutTier = new Uint8Array(cols);

    // Up to MAX_SCENE_TIERS (12) + 3 wash overlay tiers
    const MAX_BATCH_TIERS = MAX_SCENE_TIERS + 3;
    const firstCol = new Int32Array(MAX_BATCH_TIERS);
    const lastCol = new Int32Array(MAX_BATCH_TIERS);

    let panelRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let targetPanelDoc = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let smoothPanelDoc = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let headerRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let footerRects: { left: number; top: number; right: number; bottom: number }[] = [];

    const getIsLight = () =>
      document.documentElement.classList.contains('light') ||
      resolvedThemeRef.current === 'light';

    const measurePanel = () => {
      const sx = window.scrollX || 0;
      const sy = window.scrollY || 0;
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) {
          targetPanelDoc = {
            left: r.left + sx,
            top: r.top + sy,
            right: r.right + sx,
            bottom: r.bottom + sy,
            valid: true,
          };
          if (!smoothPanelDoc.valid || snapPanelRef.current || reducedMotionRef.current) {
            smoothPanelDoc = { ...targetPanelDoc };
            snapPanelRef.current = false;
          }
          panelRect = {
            left: smoothPanelDoc.left - sx,
            top: smoothPanelDoc.top - sy,
            right: smoothPanelDoc.right - sx,
            bottom: smoothPanelDoc.bottom - sy,
            valid: true,
          };
        } else {
          targetPanelDoc.valid = false;
          panelRect.valid = false;
        }
      } else {
        targetPanelDoc.valid = false;
        panelRect.valid = false;
      }

      const hdr = document.querySelector('[data-ascii-header="true"]');
      if (hdr) {
        const hr = hdr.getBoundingClientRect();
        headerRect =
          hr.width > 10 && hr.height > 10
            ? { left: hr.left, top: hr.top, right: hr.right, bottom: hr.bottom, valid: true }
            : { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
      } else {
        headerRect.valid = false;
      }

      const ftrs = document.querySelectorAll('[data-ascii-footer="true"]');
      const nextFooters: { left: number; top: number; right: number; bottom: number }[] = [];
      ftrs.forEach((ftr) => {
        const fr = ftr.getBoundingClientRect();
        if (fr.width > 5 && fr.height > 4) {
          nextFooters.push({
            left: fr.left,
            top: fr.top,
            right: fr.right,
            bottom: fr.bottom,
          });
        }
      });
      footerRects = nextFooters;
    };

    const buildViewport = (): SceneViewport => ({
      width,
      height,
      cols,
      rows,
      cellW,
      cellH,
      isPhone: width < 760,
      isLight: getIsLight(),
    });

    const notifyScenesResize = () => {
      const vp = buildViewport();
      const seen = new Set<AsciiScene>();
      (Object.values(SCENE_REGISTRY) as AsciiScene[]).forEach((scene) => {
        if (!seen.has(scene)) {
          seen.add(scene);
          scene.onResize?.(vp);
        }
      });
    };

    const setupGrid = (force = false) => {
      const nextW = window.innerWidth;
      const nextH = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);

      if (
        !force &&
        lastSetupWidth > 0 &&
        Math.abs(nextW - lastSetupWidth) < 2 &&
        Math.abs(nextH - lastSetupHeight) < 125
      ) {
        measurePanel();
        return;
      }

      width = nextW;
      height = nextH;
      lastSetupWidth = width;
      lastSetupHeight = height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const isPhone = width < 760;
      fontSize = isPhone ? 9 : 8;
      cellH = isPhone ? 9.5 : 8.5;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cssMono = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-mono')
        .trim();
      const candidateFont = `${fontSize}px ${
        cssMono ? `${cssMono}, ` : ''
      }Consolas, "SFMono-Regular", "Liberation Mono", Menlo, "Courier New", monospace`;

      ctx.font = candidateFont;
      const spaceW = ctx.measureText('          ').width / 10;
      const charW = ctx.measureText('MMMMMMMMMM').width / 10;

      if (charW > 2.5 && Math.abs(spaceW - charW) < 0.05) {
        resolvedFontStr = candidateFont;
        cellW = charW;
      } else {
        resolvedFontStr = `${fontSize}px Consolas, "Courier New", monospace`;
        ctx.font = resolvedFontStr;
        const fallbackW = ctx.measureText('MMMMMMMMMM').width / 10;
        cellW = fallbackW > 2.5 ? fallbackW : fontSize * 0.6;
      }

      ctx.textBaseline = 'top';

      cols = Math.max(50, Math.ceil(width / cellW) + 2);
      rows = Math.max(40, Math.ceil(height / cellH) + 1);

      currBuffers = createBuffers(cols * rows);
      if (prevBuffers) {
        prevBuffers = createBuffers(cols * rows);
      }
      washCrestCol = new Float32Array(cols);
      bayArchTable = new Float32Array(cols);
      rowOutChar = new Uint16Array(cols);
      rowOutTier = new Uint8Array(cols);

      for (let c = 0; c < cols; c++) {
        const uCol = c / cols;
        bayArchTable[c] =
          Math.sin(uCol * Math.PI) * 0.045 +
          Math.sin(uCol * Math.PI * 3.2 + 0.4) * 0.024 +
          Math.cos(uCol * Math.PI * 6.4 - 0.7) * 0.01;
      }

      notifyScenesResize();
      measurePanel();
    };

    const resolveCellFromBuffers = (
      buffers: SceneCellBuffers,
      cellIdx: number,
      c: number,
      r: number,
      panelAtten: number,
      ramp: string,
      paletteLen: number,
      washActive: boolean
    ): { charCode: number; tier: number } => {
      if (panelAtten <= 0.01) {
        return { charCode: 0, tier: 0 };
      }

      const customCode = buffers.charCodes[cellIdx];
      const rawTier = buffers.tiers[cellIdx];
      const tier = rawTier < paletteLen ? rawTier : paletteLen - 1;

      if (customCode > 0) {
        if (customCode === 32) {
          return { charCode: 0, tier: 0 };
        }
        if (panelAtten < 0.28) {
          return { charCode: 0, tier: 0 };
        }
        if (panelAtten < 0.92 && fastHash(c, r) > panelAtten) {
          return { charCode: 0, tier: 0 };
        }
        return { charCode: customCode, tier };
      }

      const luma = buffers.lumas[cellIdx];
      if (luma <= 0.0) {
        return { charCode: 0, tier: 0 };
      }

      const dither = luma > 0.02 && luma < 0.78 ? (fastHash(c, r) - 0.5) * 0.075 : 0.0;
      const finalLuma = Math.max(0, Math.min(0.999, (luma + dither) * panelAtten));
      let charIdx = Math.floor(finalLuma * ramp.length);

      if (!washActive && panelAtten > 0 && panelAtten < 0.35 && charIdx > 0) {
        charIdx = 0;
      }
      if (charIdx <= 0) {
        return { charCode: 0, tier: 0 };
      }
      return { charCode: ramp.charCodeAt(charIdx), tier };
    };

    const drawReadabilityVeil = (
      scene: AsciiScene,
      isLight: boolean,
      washActive: boolean,
      washProgress: number,
      fadeOutActive: boolean,
      fadeOutFactor: number,
      isFadingIn: boolean,
      fadeFactor: number
    ) => {
      const veil = scene.getVeilStyle?.(isLight);

      let veilAlpha = 1.0;
      if (isWashingOrSwappingRef.current) {
        if (washActive) {
          veilAlpha = Math.max(0, 1.0 - washProgress * 1.6);
        } else if (fadeOutActive) {
          veilAlpha = Math.max(0, 1.0 - fadeOutFactor);
        } else {
          veilAlpha = 0.0;
        }
      } else if (isFadingIn) {
        veilAlpha = fadeFactor;
      }

      if (isLight) {
        if (headerRect.valid) {
          const hGrad = ctx.createLinearGradient(0, 0, 0, headerRect.bottom + 40);
          hGrad.addColorStop(0, 'hsla(195, 25%, 94%, 0.52)');
          hGrad.addColorStop(1, 'hsla(195, 25%, 94%, 0.0)');
          ctx.fillStyle = hGrad;
          ctx.fillRect(0, 0, width, headerRect.bottom + 40);
        }

        if (panelRect.valid && veilAlpha > 0.01) {
          const cx = (panelRect.left + panelRect.right) * 0.5;
          const cy = (panelRect.top + panelRect.bottom) * 0.5;
          const rx = Math.max(260, (panelRect.right - panelRect.left) * 0.85 + 90);
          const ry = Math.max(180, (panelRect.bottom - panelRect.top) * 0.75 + 90);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, ry / rx);
          const grad = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
          const centerColor = veil?.lightCenterRgba ?? 'hsla(42, 30%, 96%, 0.64)';
          const midColor = veil?.lightMidRgba ?? 'hsla(42, 28%, 95%, 0.36)';
          ctx.globalAlpha = veilAlpha;
          grad.addColorStop(0, centerColor);
          grad.addColorStop(0.65, midColor);
          grad.addColorStop(1, 'hsla(42, 28%, 95%, 0.0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (veil?.darkCenterRgba && panelRect.valid && veilAlpha > 0.01) {
        const cx = (panelRect.left + panelRect.right) * 0.5;
        const cy = (panelRect.top + panelRect.bottom) * 0.5;
        const rx = Math.max(240, (panelRect.right - panelRect.left) * 0.8 + 80);
        const ry = Math.max(160, (panelRect.bottom - panelRect.top) * 0.7 + 80);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        ctx.globalAlpha = veilAlpha;
        const grad = ctx.createRadialGradient(0, 0, rx * 0.12, 0, 0, rx);
        grad.addColorStop(0, veil.darkCenterRgba);
        grad.addColorStop(0.65, veil.darkMidRgba ?? 'rgba(11, 14, 18, 0.22)');
        grad.addColorStop(1, 'rgba(11, 14, 18, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const drawScene = (now: number) => {
      const dt = reducedMotionRef.current
        ? 0
        : Math.min(0.1, Math.max(0, (now - prevDrawTime) * 0.001));
      prevDrawTime = now;

      const t = reducedMotionRef.current ? 12.5 : now * 0.001;
      const isLight = getIsLight();
      const isHome = isHomeRef.current;
      const isPhone = width < 760;

      if (reducedMotionRef.current) {
        pointerX = 0;
        pointerY = 0;
      } else {
        const lerp = Math.min(1, dt * 5.5);
        pointerX += (targetPointerX - pointerX) * lerp;
        pointerY += (targetPointerY - pointerY) * lerp;
      }

      // Evaluate route transition wash state (beach scene only)
      let washActive = false;
      let washProgress = 0;
      if (washStartRef.current >= 0 && activeSceneIdRef.current === 'beach') {
        const elapsed = now - washStartRef.current;
        if (elapsed >= 0 && elapsed <= WASH_DURATION_MS) {
          washActive = true;
          washProgress = Math.min(1.0, elapsed / WASH_DURATION_MS);
        } else if (elapsed > WASH_DURATION_MS) {
          washActive = false;
          washStartRef.current = -1;
        }
      } else {
        washStartRef.current = -1;
      }

      // Evaluate route transition fade-out state (non-beach scenes)
      let fadeOutActive = false;
      let fadeOutFactor = 0.0;
      if (fadeOutStartRef.current >= 0) {
        const fadeOutElapsed = now - fadeOutStartRef.current;
        if (fadeOutElapsed >= 0 && fadeOutElapsed <= NON_BEACH_FADE_OUT_MS) {
          fadeOutActive = true;
          const fp = fadeOutElapsed / NON_BEACH_FADE_OUT_MS;
          fadeOutFactor = fp * fp * (3 - 2 * fp);
        } else if (fadeOutElapsed > NON_BEACH_FADE_OUT_MS) {
          fadeOutStartRef.current = -1;
        }
      }

      // Evaluate page fade-in state
      let isFadingIn = false;
      let fadeFactor = 1.0;
      let attenFadeFactor = 1.0;
      if (fadeStartRef.current >= 0) {
        const fadeElapsed = now - fadeStartRef.current;
        if (fadeElapsed >= 0 && fadeElapsed <= FADE_DURATION_MS) {
          isFadingIn = true;
          const fp = fadeElapsed / FADE_DURATION_MS;
          fadeFactor = fp * fp * (3 - 2 * fp);
          // Ease-out attenuation slightly ahead of text fade so mobile content stays crisp
          const ap = Math.min(1.0, fadeElapsed / (isPhone ? 280 : 340));
          attenFadeFactor = 1.0 - Math.pow(1.0 - ap, 2.2);
        } else {
          fadeStartRef.current = -1;
        }
      }

      if (isFadingIn || washActive || fadeOutActive) {
        measurePanel();
      }

      if (targetPanelDoc.valid) {
        if (!smoothPanelDoc.valid || snapPanelRef.current || reducedMotionRef.current) {
          smoothPanelDoc = { ...targetPanelDoc };
          snapPanelRef.current = false;
        } else if (!isWashingOrSwappingRef.current) {
          const smoothDt = Math.min(0.064, Math.max(0.001, dt || 0.016));
          const alpha = 1 - Math.exp(-13.5 * smoothDt);
          smoothPanelDoc.left += (targetPanelDoc.left - smoothPanelDoc.left) * alpha;
          smoothPanelDoc.top += (targetPanelDoc.top - smoothPanelDoc.top) * alpha;
          smoothPanelDoc.right += (targetPanelDoc.right - smoothPanelDoc.right) * alpha;
          smoothPanelDoc.bottom += (targetPanelDoc.bottom - smoothPanelDoc.bottom) * alpha;
        }
        const sx = window.scrollX || 0;
        const sy = window.scrollY || 0;
        panelRect = {
          left: smoothPanelDoc.left - sx,
          top: smoothPanelDoc.top - sy,
          right: smoothPanelDoc.right - sx,
          bottom: smoothPanelDoc.bottom - sy,
          valid: true,
        };
      } else {
        panelRect.valid = false;
        smoothPanelDoc.valid = false;
      }

      // Evaluate scene switch transition state
      let sceneSwitchActive = false;
      let rawSwitchProgress = 1.0;
      let sceneSwitchProgress = 1.0;
      if (sceneSwitchStartRef.current >= 0 && prevSceneIdRef.current) {
        const switchElapsed = now - sceneSwitchStartRef.current;
        if (switchElapsed >= 0 && switchElapsed <= SCENE_SWITCH_DURATION_MS) {
          sceneSwitchActive = true;
          rawSwitchProgress = switchElapsed / SCENE_SWITCH_DURATION_MS;
          sceneSwitchProgress = easeInOutCubic(rawSwitchProgress);
        } else {
          sceneSwitchStartRef.current = -1;
          prevSceneIdRef.current = null;
        }
      }

      const rowScale = rows / 64;
      const invRowScale = 1 / rowScale;
      const invColScale = 180 / cols;

      if (washActive) {
        const headerBottomRow = headerRect.valid
          ? Math.max(1.5, headerRect.bottom / cellH)
          : 2 * rowScale;
        const panelTopRow = panelRect.valid
          ? Math.max(headerBottomRow, Math.floor(panelRect.top / cellH) - 2)
          : headerBottomRow;
        const panelBottomRow = panelRect.valid
          ? Math.min(rows + 4 * rowScale, Math.ceil(panelRect.bottom / cellH) + 6)
          : rows + 4 * rowScale;
        const washSpanRows = Math.max(
          rows + 4 * rowScale - headerBottomRow,
          panelBottomRow - panelTopRow + 10 * rowScale
        );

        for (let c = 0; c < cols; c++) {
          const uCol = c / cols;
          const cuspOffset =
            (bayArchTable[c] * (isPhone ? 7.5 : 12.0) +
              Math.sin(uCol * Math.PI * 3.5 + t * 2.2) * (isPhone ? 1.8 : 2.4) +
              Math.cos(uCol * Math.PI * 6.0 - t * 1.8) * (isPhone ? 0.9 : 1.2)) *
            rowScale;
          const startR = headerBottomRow + cuspOffset;
          const endR = headerBottomRow + washSpanRows + cuspOffset;
          washCrestCol[c] = startR + (endR - startR) * washProgress;
        }
      }

      const activeScene = SCENE_REGISTRY[activeSceneIdRef.current] ?? beachScene;
      const prevScene =
        sceneSwitchActive && prevSceneIdRef.current
          ? SCENE_REGISTRY[prevSceneIdRef.current] ?? beachScene
          : null;
      const isFadeSwitch =
        Boolean(prevScene) &&
        sceneSwitchActive &&
        (prevSceneIdRef.current !== 'beach' || activeSceneIdRef.current !== 'beach');
      const isSweepSwitch = Boolean(prevScene) && sceneSwitchActive && !isFadeSwitch;

      let fadeSwitchAlpha = 1.0;
      let renderTargetScene: AsciiScene = activeScene;
      if (isFadeSwitch && prevScene) {
        if (rawSwitchProgress < 0.48) {
          renderTargetScene = prevScene;
          fadeSwitchAlpha = 1.0 - easeInOutCubic(rawSwitchProgress / 0.48);
        } else {
          renderTargetScene = activeScene;
          fadeSwitchAlpha = easeInOutCubic((rawSwitchProgress - 0.48) / 0.52);
        }
      }

      const frame: SceneFrameContext = {
        width,
        height,
        cols,
        rows,
        cellW,
        cellH,
        isPhone,
        isLight,
        t,
        dt,
        pointerX,
        pointerY,
        reducedMotion: reducedMotionRef.current,
        isHome,
        washActive,
        washProgress,
        washCrestRows: washActive ? washCrestCol : null,
      };

      ctx.clearRect(0, 0, width, height);

      // Draw backdrop (clean fade-out/fade-in when non-beach scenes are involved; sweep crossfade otherwise)
      if (isFadeSwitch) {
        ctx.save();
        ctx.globalAlpha = fadeSwitchAlpha;
        renderTargetScene.renderBackdrop(ctx, frame);
        ctx.restore();
      } else if (prevScene && isSweepSwitch) {
        ctx.save();
        ctx.globalAlpha = 1 - sceneSwitchProgress;
        prevScene.renderBackdrop(ctx, frame);
        ctx.globalAlpha = sceneSwitchProgress;
        activeScene.renderBackdrop(ctx, frame);
        ctx.restore();
      } else {
        activeScene.renderBackdrop(ctx, frame);
      }

      drawReadabilityVeil(
        renderTargetScene,
        isLight,
        washActive,
        washProgress,
        fadeOutActive,
        fadeOutFactor,
        isFadingIn,
        fadeFactor
      );

      // Evaluate scene cells
      clearBuffers(currBuffers);
      renderTargetScene.renderCells(frame, currBuffers);

      if (prevScene && isSweepSwitch) {
        if (!prevBuffers || prevBuffers.lumas.length !== cols * rows) {
          prevBuffers = createBuffers(cols * rows);
        } else {
          clearBuffers(prevBuffers);
        }
        prevScene.renderCells(frame, prevBuffers);
      }

      const activePalette = renderTargetScene.getPalette(isLight);
      const activePaletteLen = Math.min(MAX_SCENE_TIERS, activePalette.length);
      const activeRamp = renderTargetScene.ramp ?? DEFAULT_ASCII_RAMP;
      const washTheme = renderTargetScene.getWashTheme?.(isLight) ?? defaultWashTheme(isLight);
      const crestChars = washTheme.crestChars ?? DEFAULT_CREST_CHARS;
      const wakeChars = washTheme.wakeChars ?? DEFAULT_WAKE_CHARS;

      const prevPalette = isSweepSwitch && prevScene ? prevScene.getPalette(isLight) : null;
      const prevPaletteLen = prevPalette
        ? Math.min(MAX_SCENE_TIERS, prevPalette.length)
        : 0;
      const prevRamp = prevScene?.ramp ?? DEFAULT_ASCII_RAMP;

      const washTroughTier = activePaletteLen;
      const washWakeTier = activePaletteLen + 1;
      const washCrestTier = activePaletteLen + 2;
      const totalCurrTiers = washActive ? activePaletteLen + 3 : activePaletteLen;

      ctx.font = resolvedFontStr;

      const falloffRadius = isPhone ? 65 : 115;
      const headerFalloff = washActive ? 6 : 28;
      const footerFalloff = 12;
      const tInt4 = Math.floor(t * 4);
      const washEdgeFade = washActive
        ? smoothstep(0.0, 0.06, washProgress) * (1.0 - smoothstep(0.9, 1.0, washProgress))
        : 0;
      const washWakeBack = isPhone ? -8.5 : -7.0;
      const washFrontAhead = isPhone ? 3.8 : 3.2;

      if (isFadeSwitch) {
        ctx.save();
        ctx.globalAlpha = fadeSwitchAlpha;
      }

      for (let r = 0; r < rows; r++) {
        for (let b = 0; b < totalCurrTiers; b++) {
          firstCol[b] = -1;
          lastCol[b] = -1;
        }

        const py = (r + 0.5) * cellH;
        const rNorm = r * invRowScale;
        const rowBase = r * cols;

        const checkHeader =
          headerRect.valid &&
          py >= headerRect.top - headerFalloff &&
          py <= headerRect.bottom + headerFalloff;
        const checkFooter =
          footerRects.length > 0 &&
          footerRects.some(
            (fr) => py >= fr.top - footerFalloff && py <= fr.bottom + footerFalloff
          );
        const checkPanel =
          panelRect.valid &&
          py >= panelRect.top - falloffRadius - 24 &&
          py <= panelRect.bottom + falloffRadius + 24;

        const sweepCol = isSweepSwitch
          ? -6 +
            (cols + 12) * sceneSwitchProgress +
            Math.sin(rNorm * 0.45 + t * 3.2) * (isPhone ? 2.2 : 4.2)
          : cols + 100;
        const switchCrestHalf = isPhone ? 2.4 : 3.6;

        let hasPrevInRow = false;
        let hasShimmerInRow = false;

        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cellW;
          const cNorm = c * invColScale;

          let panelAtten = 1.0;

          if (checkHeader) {
            const hd = sdRoundedBox(
              px,
              py,
              headerRect.left - 4,
              headerRect.top - 2,
              headerRect.right + 4,
              headerRect.bottom + 2,
              6
            );
            if (hd < headerFalloff) {
              const hFactor = hd <= 0 ? 0.0 : smoothstep(0, headerFalloff, hd);
              panelAtten = Math.min(panelAtten, hFactor);
            }
          }

          if (checkFooter) {
            for (let fi = 0; fi < footerRects.length; fi++) {
              const fr = footerRects[fi];
              const fd = sdRoundedBox(
                px,
                py,
                fr.left - (isPhone ? 8 : 4),
                fr.top - (isPhone ? 4 : 2),
                fr.right + (isPhone ? 8 : 4),
                fr.bottom + (isPhone ? 4 : 2),
                isPhone ? 6 : 4
              );
              if (fd < footerFalloff) {
                const fFactor = fd <= 0 ? 0.0 : smoothstep(0, footerFalloff, fd);
                panelAtten = Math.min(panelAtten, fFactor);
              }
            }
          }

          let rawPanelAtten = 1.0;
          if (checkPanel && px <= panelRect.right + falloffRadius + 48) {
            const rawDist = sdRoundedBox(
              px,
              py,
              panelRect.left - (isPhone ? 10 : 6),
              panelRect.top - (isPhone ? 8 : 6),
              panelRect.right + (isPhone ? 10 : -18),
              panelRect.bottom + (isPhone ? 14 : 6),
              isPhone ? 24 : 36
            );
            if (rawDist < falloffRadius + 48) {
              const boundaryNoise =
                (valueNoise2D(cNorm * 0.06 + t * 0.15, rNorm * 0.12) - 0.5) *
                  (isPhone ? 22.0 : 52.0) +
                Math.sin(rNorm * 0.45 - t * 1.2) * (isPhone ? 8.0 : 20.0);
              const d = rawDist <= 0 ? rawDist : rawDist + boundaryNoise;

              if (isHome) {
                const homeHalo = isPhone ? 36 : 85;
                if (d <= 0) {
                  rawPanelAtten = 0.0;
                } else if (d < homeHalo) {
                  rawPanelAtten = Math.min(rawPanelAtten, smoothstep(0, homeHalo, d));
                }
              } else {
                if (d <= 0) {
                  rawPanelAtten = 0.0;
                } else if (d < falloffRadius) {
                  rawPanelAtten = Math.min(rawPanelAtten, smoothstep(0, falloffRadius, d));
                }
              }
            }
          }

          let boxAtten = rawPanelAtten;
          if (isWashingOrSwappingRef.current) {
            if (washActive) {
              const crestR = washCrestCol[c];
              const distToWave = (r - crestR) * invRowScale;
              if (distToWave <= 0) {
                boxAtten = 1.0;
              } else if (distToWave <= 1.4) {
                const wipeFrac = distToWave / 1.4;
                boxAtten = 1.0 - wipeFrac * (1.0 - rawPanelAtten);
              } else {
                boxAtten = rawPanelAtten;
              }
            } else if (fadeOutActive) {
              boxAtten = rawPanelAtten + fadeOutFactor * (1.0 - rawPanelAtten);
            } else {
              boxAtten = 1.0;
            }
          } else if (isFadingIn) {
            boxAtten = 1.0 - attenFadeFactor * (1.0 - rawPanelAtten);
          }

          panelAtten = Math.min(panelAtten, boxAtten);

          // Route transition wave wash overlay
          let washOverlayLuma = 0.0;
          let washOverlayTier = -1;
          let washOverlayCharCode = 0;

          if (washActive && !checkHeader) {
            const crestR = washCrestCol[c];
            const dist = (r - crestR) * invRowScale;

            if (dist >= washWakeBack && dist <= washFrontAhead) {
              if (dist > 1.2) {
                const s = (washFrontAhead - dist) / (washFrontAhead - 1.2);
                washOverlayLuma = 0.45 * s * washEdgeFade;
                washOverlayTier = washTroughTier;
                const charIdx = Math.min(
                  activeRamp.length - 1,
                  Math.max(1, Math.floor(washOverlayLuma * activeRamp.length))
                );
                washOverlayCharCode = activeRamp.charCodeAt(charIdx);
              } else if (dist >= -2.2) {
                const crestCore = 1.0 - Math.abs(dist) / 2.2;
                const froth = valueNoise2D(cNorm * 0.18 + t * 0.5, rNorm * 0.35 - t * 0.6);
                washOverlayLuma = Math.min(
                  0.99,
                  (0.86 + 0.13 * crestCore + froth * 0.06) * washEdgeFade
                );
                washOverlayTier = washCrestTier;
                const ci = Math.min(
                  crestChars.length - 1,
                  Math.floor((crestCore * 0.7 + froth * 0.35) * crestChars.length)
                );
                washOverlayCharCode = crestChars.charCodeAt(Math.max(0, ci));
              } else {
                const wakeDist = (-dist - 2.2) / Math.max(1, -washWakeBack - 2.2);
                const wakeDecay = 1.0 - wakeDist;
                const lace = valueNoise2D(cNorm * 0.22 + t * 0.3, rNorm * 0.32);
                const h = fastHash(c + tInt4, r);

                if (lace * wakeDecay > 0.28) {
                  washOverlayLuma = (0.52 + 0.38 * wakeDecay * lace) * washEdgeFade;
                  washOverlayTier = washOverlayLuma > 0.72 ? washCrestTier : washWakeTier;
                  const wi = Math.min(
                    wakeChars.length - 1,
                    Math.floor(washOverlayLuma * wakeChars.length)
                  );
                  washOverlayCharCode = wakeChars.charCodeAt(Math.max(0, wi));
                } else if (h < 0.65 && wakeDecay > 0.32) {
                  washOverlayLuma = (0.34 + 0.24 * wakeDecay) * washEdgeFade;
                  washOverlayTier = washTroughTier;
                  const wi = Math.min(
                    wakeChars.length - 1,
                    Math.floor(washOverlayLuma * wakeChars.length)
                  );
                  washOverlayCharCode = wakeChars.charCodeAt(Math.max(0, wi));
                }
              }
            }
          }

          const cellIdx = rowBase + c;
          const isTransitionWave = washOverlayTier >= 0 && washOverlayLuma > 0.05;

          if (isTransitionWave && washOverlayCharCode > 0) {
            rowOutChar[c] = washOverlayCharCode;
            rowOutTier[c] = washOverlayTier;
            if (firstCol[washOverlayTier] === -1) firstCol[washOverlayTier] = c;
            lastCol[washOverlayTier] = c;
            continue;
          }

          if (isSweepSwitch && prevBuffers && prevScene) {
            const distToSweep = c - sweepCol;
            if (Math.abs(distToSweep) <= switchCrestHalf) {
              if (panelAtten > 0.18 && fastHash(c + tInt4, r) < 0.85 * panelAtten) {
                const si = Math.floor(
                  (1 - Math.abs(distToSweep) / switchCrestHalf) * SWITCH_SHIMMER_CHARS.length
                );
                rowOutChar[c] = SWITCH_SHIMMER_CHARS.charCodeAt(
                  Math.max(0, Math.min(SWITCH_SHIMMER_CHARS.length - 1, si))
                );
                rowOutTier[c] = 254;
                hasShimmerInRow = true;
              } else {
                rowOutChar[c] = 0;
              }
              continue;
            } else if (distToSweep > switchCrestHalf) {
              const resolvedPrev = resolveCellFromBuffers(
                prevBuffers,
                cellIdx,
                c,
                r,
                panelAtten,
                prevRamp,
                prevPaletteLen,
                washActive
              );
              rowOutChar[c] = resolvedPrev.charCode;
              if (resolvedPrev.charCode > 0) {
                rowOutTier[c] = 128 + resolvedPrev.tier;
                hasPrevInRow = true;
              }
              continue;
            }
          }

          const resolved = resolveCellFromBuffers(
            currBuffers,
            cellIdx,
            c,
            r,
            panelAtten,
            activeRamp,
            activePaletteLen,
            washActive
          );
          rowOutChar[c] = resolved.charCode;
          if (resolved.charCode > 0) {
            rowOutTier[c] = resolved.tier;
            if (firstCol[resolved.tier] === -1) firstCol[resolved.tier] = c;
            lastCol[resolved.tier] = c;
          }
        }

        const yPos = r * cellH;

        // Draw active scene tiers + wash overlay tiers
        for (let b = 0; b < totalCurrTiers; b++) {
          const startC = firstCol[b];
          if (startC === -1) continue;
          const endC = lastCol[b];
          let str = '';
          for (let c = startC; c <= endC; c++) {
            str +=
              rowOutChar[c] > 0 && rowOutTier[c] === b
                ? String.fromCharCode(rowOutChar[c])
                : ' ';
          }
          if (b < activePaletteLen) {
            ctx.fillStyle = activePalette[b];
          } else if (b === washTroughTier) {
            ctx.fillStyle = washTheme.troughColor;
          } else if (b === washWakeTier) {
            ctx.fillStyle = washTheme.wakeColor;
          } else {
            ctx.fillStyle = washTheme.crestColor;
          }
          ctx.fillText(str, startC * cellW, yPos);
        }

        // Draw receding previous scene tiers during scene switch sweep
        if (hasPrevInRow && prevPalette) {
          for (let b = 0; b < prevPaletteLen; b++) {
            const targetTier = 128 + b;
            let startC = -1;
            let endC = -1;
            for (let c = 0; c < cols; c++) {
              if (rowOutChar[c] > 0 && rowOutTier[c] === targetTier) {
                if (startC === -1) startC = c;
                endC = c;
              }
            }
            if (startC === -1) continue;
            let str = '';
            for (let c = startC; c <= endC; c++) {
              str +=
                rowOutChar[c] > 0 && rowOutTier[c] === targetTier
                  ? String.fromCharCode(rowOutChar[c])
                  : ' ';
            }
            ctx.fillStyle = prevPalette[b];
            ctx.fillText(str, startC * cellW, yPos);
          }
        }

        // Draw shimmering sweep frontier during scene switch
        if (hasShimmerInRow) {
          let startC = -1;
          let endC = -1;
          for (let c = 0; c < cols; c++) {
            if (rowOutChar[c] > 0 && rowOutTier[c] === 254) {
              if (startC === -1) startC = c;
              endC = c;
            }
          }
          if (startC !== -1) {
            let str = '';
            for (let c = startC; c <= endC; c++) {
              str +=
                rowOutChar[c] > 0 && rowOutTier[c] === 254
                  ? String.fromCharCode(rowOutChar[c])
                  : ' ';
            }
            ctx.fillStyle = isLight ? washTheme.troughColor : washTheme.crestColor;
            ctx.fillText(str, startC * cellW, yPos);
          }
        }
      }

      if (isFadeSwitch) {
        ctx.restore();
      }
    };

    drawNowRef.current = drawScene;

    const renderLoop = (now: number) => {
      if (isTabHidden || reducedMotionRef.current) return;
      rafId = requestAnimationFrame(renderLoop);

      const isTransitioning =
        washStartRef.current >= 0 ||
        fadeOutStartRef.current >= 0 ||
        sceneSwitchStartRef.current >= 0 ||
        fadeStartRef.current >= 0;
      const targetFps = isTransitioning ? 45 : width < 760 ? 24 : 32;
      const frameInterval = 1000 / targetFps;
      if (now - lastFrameTime < frameInterval) return;
      lastFrameTime = now;

      fpsFrameCount++;
      if (now - fpsWindowStart >= 1000) {
        (window as unknown as Record<string, number>).__asciiFps = Math.min(
          30,
          Math.round((fpsFrameCount * 1000) / (now - fpsWindowStart))
        );
        fpsFrameCount = 0;
        fpsWindowStart = now;
      }

      drawScene(now);
    };

    setupGrid(true);
    drawScene(performance.now());

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        setupGrid(true);
        drawScene(performance.now());
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      measurePanel();
      if (reducedMotionRef.current) drawScene(performance.now());
    });
    const observeCurrentPanel = () => {
      resizeObserver.disconnect();
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (el) resizeObserver.observe(el);
      const hdr = document.querySelector('[data-ascii-header="true"]');
      if (hdr) resizeObserver.observe(hdr);
      const ftrs = document.querySelectorAll('[data-ascii-footer="true"]');
      ftrs.forEach((ftr) => resizeObserver.observe(ftr));
      measurePanel();
    };
    observeCurrentPanel();
    const mutationObserver = new MutationObserver(() => observeCurrentPanel());
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      targetPointerX = Math.max(-1, Math.min(1, (e.clientX / Math.max(1, width) - 0.5) * 2));
      targetPointerY = Math.max(-1, Math.min(1, (e.clientY / Math.max(1, height) - 0.5) * 2));
    };
    const onPointerLeave = () => {
      targetPointerX = 0;
      targetPointerY = 0;
    };

    const onResize = () => {
      setupGrid(false);
      if (reducedMotionRef.current) drawScene(performance.now());
    };
    const onScroll = () => {
      measurePanel();
      if (reducedMotionRef.current) drawScene(performance.now());
    };
    const onVisibilityChange = () => {
      isTabHidden = document.hidden;
      if (!isTabHidden && !reducedMotionRef.current) {
        lastFrameTime = performance.now();
        prevDrawTime = lastFrameTime;
        rafId = requestAnimationFrame(renderLoop);
      }
    };
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      if (e.matches) {
        cancelAnimationFrame(rafId);
        drawScene(performance.now());
      } else if (!isTabHidden) {
        lastFrameTime = performance.now();
        prevDrawTime = lastFrameTime;
        rafId = requestAnimationFrame(renderLoop);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionChange);

    if (!reducedMotionRef.current) {
      rafId = requestAnimationFrame(renderLoop);
    }

    return () => {
      drawNowRef.current = null;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-screen h-[100lvh] pointer-events-none z-0 block"
    />
  );
}
