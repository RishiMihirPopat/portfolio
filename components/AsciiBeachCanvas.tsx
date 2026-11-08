'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

export type BeachSectionId =
  | 'home'
  | 'projects'
  | 'resume'
  | 'photography'
  | 'blog'
  | 'experience'
  | 'academics'
  | 'skills';

export interface SceneParams {
  shoreAngle: number;
  tidePosition: number;
  swellSpeed: number;
  foamDensity: number;
  waveHeight: number;
  waveFreq: number;
  brightness: number;
  shallowsSpread: number;
}

// Constant baseline scene parameters
const CONSTANT_SCENE: SceneParams = {
  shoreAngle: 0.05,
  tidePosition: 0.64,
  swellSpeed: 0.88,
  foamDensity: 1.0,
  waveHeight: 1.05,
  waveFreq: 1.0,
  brightness: 1.0,
  shallowsSpread: 0.42,
};

export const WASH_SURGE_MS = 520;
export const WASH_REVEAL_MS = 630;
export const WASH_TOTAL_MS = WASH_SURGE_MS + WASH_REVEAL_MS; // 1150ms

// 12-step brightness ramp driven by per-cell luminance
const RAMP = ' .,:;-=+*#%@';
const RAMP_MAX = RAMP.length - 1; // 11

// Precomputed 512-entry permutation table for fast 2D Value Noise & FBM
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

function fbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(px, py);
    norm += amp;
    const nx = (px * 0.8 - py * 0.6) * 2.03 + 1.7;
    const ny = (px * 0.6 + py * 0.8) * 2.03 + 9.2;
    px = nx;
    py = ny;
    amp *= 0.5;
  }
  return value / norm;
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

const NUM_TIERS = 8;

export function AsciiBeachCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const isHomeRef = useRef<boolean>(true);
  const lastPathRef = useRef<string | null>(null);
  const reducedMotionRef = useRef<boolean>(false);
  const washStartRef = useRef<number>(-1);
  const washRevealStartRef = useRef<number>(-1);

  useEffect(() => {
    const clean = (pathname || '/').replace(/\/+$/, '') || '/';
    isHomeRef.current = clean === '/';

    if (lastPathRef.current !== null && lastPathRef.current !== clean) {
      const now = performance.now();
      if (washStartRef.current < 0) {
        if (!reducedMotionRef.current) {
          washStartRef.current = now;
          washRevealStartRef.current = -1;
        }
      }
    }
    lastPathRef.current = clean;
  }, [pathname]);

  useEffect(() => {
    const onWaveWash = () => {
      if (!reducedMotionRef.current) {
        washStartRef.current = performance.now();
        washRevealStartRef.current = -1;
      }
    };
    const onWaveReveal = () => {
      if (!reducedMotionRef.current && washStartRef.current >= 0) {
        washRevealStartRef.current = performance.now();
      }
    };
    window.addEventListener('ascii-wave-wash', onWaveWash);
    window.addEventListener('ascii-wave-reveal', onWaveReveal);
    return () => {
      window.removeEventListener('ascii-wave-wash', onWaveWash);
      window.removeEventListener('ascii-wave-reveal', onWaveReveal);
    };
  }, []);

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

    let wetSandBuffer = new Float32Array(cols * rows);
    let baseShoreCol = new Float32Array(cols);
    let peakRunupCol = new Float32Array(cols);
    let highTideCol = new Float32Array(cols);
    let washLeadCol = new Float32Array(cols);
    let washTrailCol = new Float32Array(cols);
    let uColTable = new Float32Array(cols);
    let bayArchTable = new Float32Array(cols);
    let rowCharIdx = new Uint8Array(cols);
    let rowTierIdx = new Uint8Array(cols);

    let panelRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let headerRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let footerRects: { left: number; top: number; right: number; bottom: number }[] = [];

    const measurePanel = () => {
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (el) {
        const r = el.getBoundingClientRect();
        panelRect =
          r.width > 10 && r.height > 10
            ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, valid: true }
            : { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
      } else {
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

      wetSandBuffer = new Float32Array(cols * rows);
      baseShoreCol = new Float32Array(cols);
      peakRunupCol = new Float32Array(cols);
      highTideCol = new Float32Array(cols);
      washLeadCol = new Float32Array(cols);
      washTrailCol = new Float32Array(cols);
      uColTable = new Float32Array(cols);
      bayArchTable = new Float32Array(cols);
      rowCharIdx = new Uint8Array(cols);
      rowTierIdx = new Uint8Array(cols);

      const initSwash = Math.max(8, Math.floor(rows * 0.12));

      for (let c = 0; c < cols; c++) {
        const uCol = c / cols;
        uColTable[c] = uCol;
        const arch =
          Math.sin(uCol * Math.PI) * 0.045 +
          Math.sin(uCol * Math.PI * 3.2 + 0.4) * 0.024 +
          Math.cos(uCol * Math.PI * 6.4 - 0.7) * 0.010;
        bayArchTable[c] = arch;

        const baseTide = isPhone ? 0.56 : 0.64;
        const initShore = Math.floor(rows * (baseTide + arch + (uCol - 0.5) * 0.05));
        const maxReach = Math.floor(initShore + initSwash);
        for (let r = initShore; r <= Math.min(rows - 1, maxReach); r++) {
          const frac = 1.0 - (r - initShore) / Math.max(1, maxReach - initShore);
          wetSandBuffer[r * cols + c] = 0.20 + 0.65 * frac;
        }
      }

      measurePanel();
    };

    const firstCol = new Int32Array(NUM_TIERS);
    const lastCol = new Int32Array(NUM_TIERS);

    const drawScene = (now: number) => {
      const t = reducedMotionRef.current ? 12.5 : now * 0.001;
      const P = CONSTANT_SCENE;

      const isLight =
        document.documentElement.classList.contains('light') || resolvedTheme === 'light';
      const isHome = isHomeRef.current;
      const isPhone = width < 760;

      // Evaluate two-stage Big Wave Wash state:
      // Stage 1 (0 .. WASH_SURGE_MS): leading foam crest sweeps down from top to bottom of content,
      // filling the entire region behind it with foaming surf (washing over old content).
      // Stage 2 (WASH_SURGE_MS .. WASH_TOTAL_MS): trailing edge sweeps down from top to bottom,
      // re-clearing the panel behind it to reveal the newly loaded page content!
      let washActive = false;
      let washSurgeProgress = 0;
      let washRevealProgress = 0;

      if (washStartRef.current >= 0) {
        const elapsed = now - washStartRef.current;
        if (elapsed >= 0) {
          washActive = true;
          washSurgeProgress = easeInOutCubic(Math.min(1, elapsed / WASH_SURGE_MS));

          // Fallback if route reveal event wasn't dispatched (e.g. browser back/forward)
          if (washRevealStartRef.current < 0 && elapsed >= WASH_SURGE_MS + 250) {
            washRevealStartRef.current = now;
          }

          if (washRevealStartRef.current >= 0) {
            const revealElapsed = Math.max(0, now - washRevealStartRef.current);
            if (revealElapsed <= WASH_REVEAL_MS) {
              washSurgeProgress = 1.0;
              washRevealProgress = easeInOutCubic(revealElapsed / WASH_REVEAL_MS);
            } else {
              washActive = false;
              washStartRef.current = -1;
              washRevealStartRef.current = -1;
            }
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      const rowScale = rows / 64;
      const invRowScale = 1 / rowScale;
      const invColScale = 180 / cols;

      const swashZoneRows = Math.max(8, Math.floor(rows * 0.125));
      const swashScale = swashZoneRows * Math.min(1.35, P.waveHeight);
      const effectiveTide = isPhone ? P.tidePosition * 0.80 : P.tidePosition;

      const panelTopRow = panelRect.valid
        ? Math.max(4, Math.floor(panelRect.top / cellH) - 3)
        : Math.floor(rows * 0.08);
      const panelBottomRow = panelRect.valid
        ? Math.min(rows - 3, Math.ceil(panelRect.bottom / cellH) + 6)
        : Math.floor(rows * 0.88);
      const washSpanRows = Math.max(28, panelBottomRow - panelTopRow + 12);

      for (let c = 0; c < cols; c++) {
        const uCol = uColTable[c];
        const shoreRatio =
          effectiveTide +
          bayArchTable[c] +
          (uCol - 0.5) * P.shoreAngle +
          (valueNoise2D(uCol * 5.0 + t * 0.04, t * 0.08) - 0.5) * 0.025;

        const bRow = Math.max(
          Math.floor(rows * 0.26),
          Math.min(rows - Math.floor(13 * rowScale), rows * shoreRatio)
        );
        baseShoreCol[c] = bRow;

        const tongue1 = 0.5 + 0.5 * Math.sin(t * (1.15 * P.waveFreq) - uCol * Math.PI * 2.6);
        const tongue2 =
          0.5 + 0.5 * Math.sin(t * (0.85 * P.waveFreq) + uCol * Math.PI * 3.8 + 1.4);
        const combinedSurge = 0.65 * Math.pow(tongue1, 1.35) + 0.35 * Math.pow(tongue2, 1.5);

        peakRunupCol[c] = bRow + combinedSurge * swashScale;
        highTideCol[c] = bRow + swashScale * 0.98;

        if (washActive) {
          // Organic bay curve + scalloped cusps along the washing wave front
          const cuspOffset =
            (bayArchTable[c] * 14.0 +
              Math.sin(uCol * Math.PI * 3.5 + t * 2.2) * 2.4 +
              Math.cos(uCol * Math.PI * 6.0 - t * 1.8) * 1.2) *
            rowScale;

          const startR = panelTopRow - 4 + cuspOffset;
          const endR = panelTopRow + washSpanRows + cuspOffset;

          washLeadCol[c] =
            startR +
            (endR - startR) * washSurgeProgress +
            washRevealProgress * 12.0 * rowScale;
          washTrailCol[c] = startR + (endR - startR) * washRevealProgress;
        }
      }

      const meanShoreY = Math.min(
        0.88,
        Math.max(
          0.32,
          ((rows * effectiveTide + swashZoneRows * 0.4) * cellH) / Math.max(1, height)
        )
      );

      // Top-down aerial coastal wash
      const bgGrad = ctx.createLinearGradient(
        width * (0.5 + P.shoreAngle * 0.8),
        0,
        width * (0.5 - P.shoreAngle * 0.8),
        height
      );
      if (isLight) {
        bgGrad.addColorStop(0.0, 'hsla(198, 42%, 66%, 0.88)');
        bgGrad.addColorStop(Math.max(0.15, meanShoreY * 0.48), 'hsla(188, 38%, 71%, 0.88)');
        bgGrad.addColorStop(Math.max(0.28, meanShoreY - 0.05), 'hsla(180, 34%, 75%, 0.88)');
        bgGrad.addColorStop(meanShoreY, 'hsla(165, 22%, 74%, 0.86)');
        bgGrad.addColorStop(Math.min(1, meanShoreY + 0.08), 'hsla(32, 30%, 70%, 0.88)');
        bgGrad.addColorStop(Math.min(1, meanShoreY + 0.15), 'hsla(37, 42%, 78%, 0.90)');
        bgGrad.addColorStop(1.0, 'hsla(39, 46%, 82%, 0.92)');
      } else {
        bgGrad.addColorStop(0.0, 'hsla(206, 48%, 11%, 0.45)');
        bgGrad.addColorStop(Math.max(0.15, meanShoreY * 0.48), 'hsla(194, 44%, 14%, 0.42)');
        bgGrad.addColorStop(Math.max(0.28, meanShoreY - 0.05), 'hsla(184, 40%, 16%, 0.40)');
        bgGrad.addColorStop(meanShoreY, 'hsla(176, 28%, 15%, 0.36)');
        bgGrad.addColorStop(Math.min(1, meanShoreY + 0.08), 'hsla(30, 34%, 14%, 0.38)');
        bgGrad.addColorStop(1.0, 'hsla(36, 40%, 16%, 0.42)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // In Light Mode, add a soft feathered readability veil behind the active text column & header
      if (isLight) {
        if (headerRect.valid) {
          const hGrad = ctx.createLinearGradient(0, 0, 0, headerRect.bottom + 40);
          hGrad.addColorStop(0, 'hsla(195, 25%, 94%, 0.52)');
          hGrad.addColorStop(1, 'hsla(195, 25%, 94%, 0.0)');
          ctx.fillStyle = hGrad;
          ctx.fillRect(0, 0, width, headerRect.bottom + 40);
        }
        if (panelRect.valid) {
          const cx = (panelRect.left + panelRect.right) * 0.5;
          const cy = (panelRect.top + panelRect.bottom) * 0.5;
          const rx = Math.max(260, (panelRect.right - panelRect.left) * 0.85 + 90);
          const ry = Math.max(180, (panelRect.bottom - panelRect.top) * 0.75 + 90);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, ry / rx);
          const veil = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
          veil.addColorStop(0, 'hsla(42, 30%, 96%, 0.64)');
          veil.addColorStop(0.65, 'hsla(42, 28%, 95%, 0.36)');
          veil.addColorStop(1, 'hsla(42, 28%, 95%, 0.0)');
          ctx.fillStyle = veil;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 8 Top-Down Coastal Color Tiers
      const tiers = isLight
        ? [
            'hsla(202, 46%, 34%, 0.44)', // 0: deep ocean caustics & flowing swell drift
            'hsla(194, 48%, 30%, 0.56)', // 1: mid-ocean swell
            'hsla(186, 48%, 28%, 0.54)', // 2: turquoise shallows ripples
            'hsla(192, 54%, 20%, 0.78)', // 3: deep wave-front shadow under breaking crest
            'hsla(180, 40%, 94%, 0.78)', // 4: lacy cellular foam wake & spray
            'hsla(48,  65%, 99%, 0.98)', // 5: crisp bright white breaking surf & swash lip (#%@)
            'hsla(28,  46%, 26%, 0.74)', // 6: dark damp umber wet-sand band & tide line
            'hsla(34,  48%, 36%, 0.62)', // 7: warm golden-ochre dry sand grain
          ]
        : [
            'hsla(204, 48%, 48%, 0.38)', // 0: deep ocean swells & caustics
            'hsla(194, 46%, 58%, 0.52)', // 1: mid-ocean swell face
            'hsla(184, 45%, 64%, 0.58)', // 2: turquoise shallows
            'hsla(192, 42%, 38%, 0.46)', // 3: wave trough shadow
            'hsla(178, 42%, 80%, 0.78)', // 4: lacy cellular foam wake & spray
            'hsla(46,  38%, 95%, 0.97)', // 5: bright ivory breaking surf & swash lip (#%@)
            'hsla(28,  40%, 44%, 0.58)', // 6: dark damp umber wet-sand band & tide line
            'hsla(38,  50%, 72%, 0.70)', // 7: warm golden-ochre dry sand grain
          ];

      ctx.font = resolvedFontStr;

      const falloffRadius = isPhone ? 65 : 115;
      const headerFalloff = 28;
      const footerFalloff = 12;
      const tInt4 = Math.floor(t * 4);
      const tInt2 = Math.floor(t * 2);

      for (let r = 0; r < rows; r++) {
        for (let b = 0; b < NUM_TIERS; b++) {
          firstCol[b] = -1;
          lastCol[b] = -1;
        }

        const py = (r + 0.5) * cellH;
        const rNorm = r * invRowScale;
        const rowWobble =
          ((valueNoise2D(rNorm * 0.42 + t * 0.24, t * 0.18) - 0.5) * 2.2 +
            Math.sin(rNorm * 0.9 + t * 0.6) * 0.65) *
          rowScale;

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

        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cellW;
          const cNorm = c * invColScale;

          let panelAtten = 1.0;

          // Header band stays readable at all times
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

          // Footer pills: gently soften sand characters underneath without punching a dark box hole
          if (checkFooter) {
            for (let fi = 0; fi < footerRects.length; fi++) {
              const fr = footerRects[fi];
              const fd = sdRoundedBox(
                px,
                py,
                fr.left - 2,
                fr.top - 1,
                fr.right + 2,
                fr.bottom + 1,
                4
              );
              if (fd < footerFalloff) {
                const fFactor =
                  fd <= 0 ? 0.28 : 0.28 + 0.72 * smoothstep(0, footerFalloff, fd);
                panelAtten = Math.min(panelAtten, fFactor);
              }
            }
          }

          // Main content column attenuation with wide organic wave-aligned feathering (no hard box outline)
          if (checkPanel && px <= panelRect.right + falloffRadius + 48) {
            const rawDist = sdRoundedBox(
              px,
              py,
              panelRect.left - 6,
              panelRect.top - 6,
              panelRect.right - (isPhone ? 0 : 18),
              panelRect.bottom + 6,
              36
            );
            if (rawDist < falloffRadius + 48) {
              const boundaryNoise =
                (valueNoise2D(cNorm * 0.06 + t * 0.15, rNorm * 0.12) - 0.5) *
                  (isPhone ? 22.0 : 52.0) +
                Math.sin(rNorm * 0.45 - t * 1.2) * (isPhone ? 8.0 : 20.0);
              const d = rawDist + boundaryNoise;

              if (isHome) {
                const homeHalo = isPhone ? 36 : 85;
                if (d <= 0) {
                  panelAtten = 0.0;
                } else if (d < homeHalo) {
                  panelAtten = Math.min(panelAtten, smoothstep(0, homeHalo, d));
                }
              } else {
                const innerFloor = isPhone ? 0.11 : 0.0;
                if (d <= 0) {
                  panelAtten = Math.min(panelAtten, innerFloor);
                } else if (d < falloffRadius) {
                  const f = smoothstep(0, falloffRadius, d);
                  panelAtten = Math.min(panelAtten, innerFloor + (1 - innerFloor) * f);
                }
              }
            }
          }

          // ==================================================================
          // TWO-STAGE BIG WAVE WASH OVERRIDE (During page transitions)
          // ==================================================================
          let washOverlayLuma = 0.0;
          let washOverlayTier = -1;

          if (washActive && !checkHeader) {
            const leadR = washLeadCol[c];
            const trailR = washTrailCol[c];

            // Is row `r` inside the active foaming wave blanket between `trailR` and `leadR`?
            const distFromLead = (leadR - r) * invRowScale; // > 0 behind leading crest
            const distFromTrail = (r - trailR) * invRowScale; // > 0 ahead of trailing edge

            if (distFromLead >= -1.8 && distFromTrail >= -3.5) {
              // Fade out smoothly at the very end of Stage 2
              const endFade = 1.0 - smoothstep(0.72, 1.0, washRevealProgress);

              if (distFromLead < 0) {
                // Dark teal trough shadow immediately in front of the crashing wave lip
                const s = (1.8 + distFromLead) / 1.8;
                washOverlayLuma = 0.44 * s * endFade;
                washOverlayTier = 3;
              } else if (distFromLead < 5.5) {
                // Thick, roaring bright white surf crest lip (* # % @)
                const crestCore = 1.0 - distFromLead / 5.5;
                const froth = valueNoise2D(cNorm * 0.16 + t * 0.5, rNorm * 0.32 - t * 0.6);
                washOverlayLuma = Math.min(
                  0.99,
                  (0.84 + 0.15 * crestCore + froth * 0.06) * endFade
                );
                washOverlayTier = 5;
              } else if (distFromTrail < 4.5 && washRevealProgress > 0.01) {
                // Receding foamy wake edge right where the new page content is being revealed
                const wakeEdge = Math.max(0, 1.0 - Math.abs(distFromTrail - 1.2) / 3.5);
                const lace = valueNoise2D(cNorm * 0.22 + t * 0.3, rNorm * 0.32);
                if (lace + wakeEdge * 0.4 > 0.48) {
                  washOverlayLuma = (0.52 + 0.36 * wakeEdge) * endFade;
                  washOverlayTier = washOverlayLuma > 0.72 ? 5 : 4;
                }
              } else {
                // Churning cellular seafoam & turquoise surf blanket covering the transition zone
                const lace = valueNoise2D(cNorm * 0.18 + t * 0.35, rNorm * 0.28 - t * 0.45);
                const subCrest = Math.sin(distFromLead * 0.85 - t * 3.0);
                const h = fastHash(c + tInt4, r);
                if (subCrest > 0.55 && lace > 0.38) {
                  washOverlayLuma = (0.76 + 0.18 * lace) * endFade;
                  washOverlayTier = 5;
                } else if (lace > 0.34 && h < 0.82) {
                  washOverlayLuma = (0.48 + 0.32 * lace) * endFade;
                  washOverlayTier = 4;
                } else {
                  washOverlayLuma = (0.34 + 0.20 * lace) * endFade;
                  washOverlayTier = 2;
                }
              }

              // Inside the active wave blanket (between trailR and leadR), override panelAtten -> 1.0
              // so the wave completely covers the content area, and smoothly re-clears behind trailR!
              if (distFromLead >= 0 && distFromTrail >= 0) {
                const trailFeather = smoothstep(0, 3.0, distFromTrail);
                const leadFeather = smoothstep(0, 1.5, distFromLead);
                const blanketCover = Math.min(trailFeather, leadFeather) * endFade;
                panelAtten = panelAtten + (1.0 - panelAtten) * blanketCover;
              }

              if (r >= baseShoreCol[c] && distFromLead >= 0 && distFromTrail >= 0) {
                wetSandBuffer[r * cols + c] = Math.max(
                  wetSandBuffer[r * cols + c],
                  0.85 * endFade
                );
              }
            }
          }

          if (panelAtten <= 0.01) {
            rowCharIdx[c] = 0;
            continue;
          }

          let luma = 0.0;
          let tierIdx = 0;

          const shoreRow = baseShoreCol[c];

          // ==================================================================
          // TOP-DOWN OCEAN & SURF ZONE (r < shoreRow)
          // ==================================================================
          if (r < shoreRow) {
            const uWater = Math.max(0, Math.min(1, r / Math.max(1, shoreRow)));
            const uCol = uColTable[c];

            const shoalCoord = Math.pow(uWater, 0.78) * 28.0 * P.waveFreq;

            const refractNoise =
              fbm(uCol * 2.8 - t * 0.06, uWater * 2.4 - t * 0.14, 2) - 0.5;
            const lateralBend =
              Math.sin(uCol * Math.PI * 2.0 + uWater * 2.2) * 1.1 +
              Math.cos(uCol * Math.PI * 4.5 - uWater * 1.6 + t * 0.3) * 0.55 +
              refractNoise * 3.4;

            const wavePhase =
              shoalCoord -
              t * (2.15 * P.waveFreq * P.swellSpeed) +
              lateralBend;

            const s1 = Math.sin(wavePhase);
            const s2 = 0.38 * Math.sin(wavePhase * 2.0 - 0.85);
            const waveHeightNorm = (s1 + s2) / 1.38;

            const crestEnvelope =
              0.48 +
              0.52 *
                valueNoise2D(
                  cNorm * 0.038 + uWater * 2.4 + t * 0.12,
                  uWater * 4.2 - t * 0.18
                );

            const wrapped =
              (((wavePhase - Math.PI * 0.42) % (Math.PI * 2)) + Math.PI * 3) %
                (Math.PI * 2) -
              Math.PI;

            const shoalIntensity = smoothstep(0.04, 0.82, uWater);
            const crestHalfWidth =
              (0.24 + 0.44 * shoalIntensity) *
              Math.min(1.35, P.waveHeight) *
              crestEnvelope;

            if (
              Math.abs(wrapped) < crestHalfWidth &&
              uWater > 0.05 &&
              crestEnvelope > 0.40
            ) {
              const crestCore = 1.0 - Math.abs(wrapped) / crestHalfWidth;
              const foamPatch = valueNoise2D(
                cNorm * 0.15 + t * 0.3,
                rNorm * 0.28 - t * 0.35
              );
              if (crestCore + foamPatch * 0.35 > 0.32) {
                luma = Math.min(0.99, (0.78 + 0.21 * crestCore) * P.brightness);
                tierIdx = 5;
              } else {
                luma = (0.58 + 0.18 * crestCore) * P.brightness;
                tierIdx = 4;
              }
            } else if (
              wrapped < -crestHalfWidth &&
              wrapped > -crestHalfWidth * (2.6 + 2.2 * shoalIntensity) &&
              uWater > 0.12 &&
              crestEnvelope > 0.40
            ) {
              const wakeSpan = crestHalfWidth * (1.6 + 2.2 * shoalIntensity);
              const wakeDecay = 1.0 - (-wrapped - crestHalfWidth) / Math.max(0.01, wakeSpan);
              const cellWeb = valueNoise2D(cNorm * 0.22 + t * 0.2, rNorm * 0.32 - t * 0.3);
              const sprayHash = fastHash(c + tInt4, r);

              if (cellWeb > 0.56 - wakeDecay * 0.28 && sprayHash < wakeDecay * 0.78 * P.foamDensity) {
                luma = (0.32 + 0.46 * wakeDecay * cellWeb) * P.brightness;
                tierIdx = 4;
              } else {
                luma = (0.20 + 0.16 * shoalIntensity) * P.brightness;
                tierIdx = uWater > 0.45 ? 2 : 1;
              }
            } else if (
              wrapped > crestHalfWidth &&
              wrapped < crestHalfWidth * 2.2 &&
              uWater > 0.12 &&
              crestEnvelope > 0.42
            ) {
              const shadowFactor = 1.0 - (wrapped - crestHalfWidth) / (crestHalfWidth * 1.2);
              luma = (0.30 + 0.36 * shadowFactor * shoalIntensity) * P.brightness;
              tierIdx = 3;
            } else {
              const swellFactor = (waveHeightNorm + 1.0) * 0.5;
              const caustic = valueNoise2D(cNorm * 0.14 + t * 0.25, rNorm * 0.22 - t * 0.2);
              const upperFlow = fbm(cNorm * 0.045 - t * 0.08, rNorm * 0.16 + t * 0.05, 3);

              if (swellFactor > 0.46) {
                luma =
                  (0.25 + (swellFactor - 0.46) * 0.62 * (0.45 + 0.55 * shoalIntensity)) *
                  P.brightness;
                tierIdx = uWater > 0.52 ? 2 : uWater > 0.24 ? 1 : 0;
              } else if (upperFlow > 0.52 && uWater < 0.42) {
                luma = (0.20 + (upperFlow - 0.52) * 0.75) * P.brightness;
                tierIdx = upperFlow > 0.66 ? 1 : 0;
              } else if (caustic > 0.64) {
                luma = (0.18 + (caustic - 0.64) * 0.55) * P.brightness;
                tierIdx = uWater > 0.50 ? 2 : 0;
              } else {
                const glint = fastHash(c + tInt2, r);
                luma = glint > 0.87 ? 0.20 : 0.0;
                tierIdx = uWater > 0.50 ? 2 : 0;
              }
            }
          }
          // ==================================================================
          // TOP-DOWN SHORE (Scalloped Swash + Glistening Wet Sand) & DRY SAND
          // ==================================================================
          else {
            const cellIdx = r * cols + c;
            const runupRow = peakRunupCol[c] + rowWobble;
            const distFromRunup = (r - runupRow) * invRowScale;
            const highTideRow = highTideCol[c] + rowWobble * 0.85;

            if (distFromRunup <= 0) {
              wetSandBuffer[cellIdx] = 1.0;

              if (distFromRunup > -1.8) {
                const lipCore = 1.0 - Math.abs(distFromRunup) / 1.8;
                luma = Math.min(0.99, 0.78 + 0.21 * lipCore);
                tierIdx = 5;
              } else if (distFromRunup > -4.5) {
                const h = fastHash(c + tInt4, r);
                const lace = valueNoise2D(cNorm * 0.2 + t * 0.25, rNorm * 0.35);
                luma = h > 0.36 && lace > 0.38 ? 0.36 + 0.38 * h : 0.0;
                tierIdx = luma > 0.46 ? 4 : 2;
              } else {
                const filmNoise = valueNoise2D(cNorm * 0.12 + t * 0.3, rNorm * 0.35);
                luma = filmNoise > 0.44 ? 0.28 + 0.14 * filmNoise : 0.0;
                tierIdx = 2;
              }
            } else {
              const prevWet = wetSandBuffer[cellIdx];
              const nextWet = prevWet * 0.986;
              wetSandBuffer[cellIdx] = nextWet;

              const distToHighTide = (r - highTideRow) * invRowScale;

              if (distToHighTide <= 1.8 || nextWet > 0.12) {
                const isDarkWetEdge =
                  Math.abs(distToHighTide) < 1.7 || (nextWet > 0.14 && nextWet < 0.45);
                if (isDarkWetEdge) {
                  luma = 0.54 + 0.18 * valueNoise2D(cNorm * 0.15, rNorm * 0.3);
                } else {
                  luma = 0.30 + 0.20 * nextWet;
                }
                tierIdx = 6;
              } else {
                const h = fastHash(c, r);
                const windRipple =
                  Math.sin(
                    (r - highTideRow) * invRowScale * 1.35 +
                      Math.sin(cNorm * 0.06) * 1.5
                  ) * 0.08;
                const grainNoise =
                  valueNoise2D(cNorm * 0.05, r * invRowScale * 0.18) + windRipple;

                if (h > 0.987) {
                  luma = 0.62 + (h - 0.987) * 15.0;
                  tierIdx = 7;
                } else if (h > 0.66 - grainNoise * 0.16) {
                  luma = 0.15 + (h - 0.52) * 0.82;
                  tierIdx = 7;
                } else {
                  luma = 0.0;
                }
              }
            }
          }

          // Blend in the Big Wave Wash crest & foam blanket when active
          if (washOverlayTier >= 0 && washOverlayLuma > luma * 0.80) {
            luma = Math.max(luma, washOverlayLuma);
            tierIdx = washOverlayTier;
          }

          const dither =
            luma > 0.02 && luma < 0.78 ? (fastHash(c, r) - 0.5) * 0.075 : 0.0;
          const finalLuma = Math.max(0, Math.min(0.999, (luma + dither) * panelAtten));
          let charIdx = Math.floor(finalLuma * (RAMP_MAX + 1));

          if (!washActive && panelAtten > 0 && panelAtten < 0.35 && charIdx > 0) {
            if (fastHash(c, r) > 0.42) {
              charIdx = 0;
            } else if (tierIdx === 5 || tierIdx === 4) {
              tierIdx = 2;
            }
          }

          rowCharIdx[c] = charIdx;
          if (charIdx > 0) {
            rowTierIdx[c] = tierIdx;
            if (firstCol[tierIdx] === -1) firstCol[tierIdx] = c;
            lastCol[tierIdx] = c;
          }
        }

        const yPos = r * cellH;
        for (let b = 0; b < NUM_TIERS; b++) {
          const startC = firstCol[b];
          if (startC === -1) continue;
          const endC = lastCol[b];
          let str = '';
          for (let c = startC; c <= endC; c++) {
            str += rowCharIdx[c] > 0 && rowTierIdx[c] === b ? RAMP[rowCharIdx[c]] : ' ';
          }
          ctx.fillStyle = tiers[b];
          ctx.fillText(str, startC * cellW, yPos);
        }
      }
    };

    const renderLoop = (now: number) => {
      if (isTabHidden || reducedMotionRef.current) return;
      rafId = requestAnimationFrame(renderLoop);

      const frameInterval = width < 760 ? 1000 / 24 : 1000 / 32;
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
        rafId = requestAnimationFrame(renderLoop);
      }
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionChange);

    if (!reducedMotionRef.current) {
      rafId = requestAnimationFrame(renderLoop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-screen h-[100lvh] pointer-events-none z-0 block"
    />
  );
}
