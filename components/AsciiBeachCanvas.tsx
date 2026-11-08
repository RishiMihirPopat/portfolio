'use client';

import { useEffect, useRef } from 'react';
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
  horizonRatio: number; // ~0.39 from top
  tidePosition: number; // ~0.68 from top (sea spans ~29% of viewport)
  cloudSpeed: number;
  cloudDensity: number;
  waveHeight: number;
  waveFreq: number;
  brightness: number;
  haze: number;
}

export const SECTION_PRESETS: Record<BeachSectionId, SceneParams> = {
  home: {
    horizonRatio: 0.39,
    tidePosition: 0.68,
    cloudSpeed: 0.85,
    cloudDensity: 1.0,
    waveHeight: 1.08,
    waveFreq: 1.0,
    brightness: 1.0,
    haze: 0.42,
  },
  projects: {
    horizonRatio: 0.37,
    tidePosition: 0.67,
    cloudSpeed: 1.25,
    cloudDensity: 1.12,
    waveHeight: 1.30,
    waveFreq: 1.22,
    brightness: 1.04,
    haze: 0.36,
  },
  photography: {
    horizonRatio: 0.39,
    tidePosition: 0.69,
    cloudSpeed: 0.65,
    cloudDensity: 0.90,
    waveHeight: 0.92,
    waveFreq: 0.84,
    brightness: 1.18,
    haze: 0.52,
  },
  blog: {
    horizonRatio: 0.38,
    tidePosition: 0.68,
    cloudSpeed: 0.75,
    cloudDensity: 1.28,
    waveHeight: 0.84,
    waveFreq: 0.90,
    brightness: 0.90,
    haze: 0.56,
  },
  resume: {
    horizonRatio: 0.40,
    tidePosition: 0.70,
    cloudSpeed: 0.45,
    cloudDensity: 0.82,
    waveHeight: 0.55,
    waveFreq: 0.74,
    brightness: 0.95,
    haze: 0.38,
  },
  experience: {
    horizonRatio: 0.40,
    tidePosition: 0.69,
    cloudSpeed: 0.48,
    cloudDensity: 0.84,
    waveHeight: 0.58,
    waveFreq: 0.76,
    brightness: 0.96,
    haze: 0.38,
  },
  academics: {
    horizonRatio: 0.40,
    tidePosition: 0.70,
    cloudSpeed: 0.42,
    cloudDensity: 0.78,
    waveHeight: 0.50,
    waveFreq: 0.70,
    brightness: 0.94,
    haze: 0.40,
  },
  skills: {
    horizonRatio: 0.39,
    tidePosition: 0.68,
    cloudSpeed: 0.55,
    cloudDensity: 0.88,
    waveHeight: 0.64,
    waveFreq: 0.80,
    brightness: 0.96,
    haze: 0.38,
  },
};

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

// 32-bit integer hash using Math.imul
function fastHash(c: number, r: number): number {
  let n = (Math.imul(c, 374761393) + Math.imul(r, 668265263)) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpParams(a: SceneParams, b: SceneParams, t: number): SceneParams {
  const e = easeInOutCubic(Math.max(0, Math.min(1, t)));
  return {
    horizonRatio: a.horizonRatio + (b.horizonRatio - a.horizonRatio) * e,
    tidePosition: a.tidePosition + (b.tidePosition - a.tidePosition) * e,
    cloudSpeed: a.cloudSpeed + (b.cloudSpeed - a.cloudSpeed) * e,
    cloudDensity: a.cloudDensity + (b.cloudDensity - a.cloudDensity) * e,
    waveHeight: a.waveHeight + (b.waveHeight - a.waveHeight) * e,
    waveFreq: a.waveFreq + (b.waveFreq - a.waveFreq) * e,
    brightness: a.brightness + (b.brightness - a.brightness) * e,
    haze: a.haze + (b.haze - a.haze) * e,
  };
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

interface AsciiBeachCanvasProps {
  activeSection?: BeachSectionId;
}

export function AsciiBeachCanvas({ activeSection = 'home' }: AsciiBeachCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const activeSecRef = useRef<BeachSectionId>(activeSection);

  const transitionRef = useRef<{
    from: SceneParams;
    to: SceneParams;
    current: SceneParams;
    startTime: number;
    duration: number;
  }>({
    from: SECTION_PRESETS[activeSection] || SECTION_PRESETS.home,
    to: SECTION_PRESETS[activeSection] || SECTION_PRESETS.home,
    current: { ...(SECTION_PRESETS[activeSection] || SECTION_PRESETS.home) },
    startTime: 0,
    duration: 1200,
  });

  useEffect(() => {
    activeSecRef.current = activeSection;
    const target = SECTION_PRESETS[activeSection] || SECTION_PRESETS.home;
    transitionRef.current = {
      from: { ...transitionRef.current.current },
      to: target,
      current: { ...transitionRef.current.current },
      startTime: performance.now(),
      duration: 1200,
    };
  }, [activeSection]);

  useEffect(() => {
    const handleSectionEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<BeachSectionId>;
      const sec = customEv.detail;
      if (sec && SECTION_PRESETS[sec]) {
        activeSecRef.current = sec;
        transitionRef.current = {
          from: { ...transitionRef.current.current },
          to: SECTION_PRESETS[sec],
          current: { ...transitionRef.current.current },
          startTime: performance.now(),
          duration: 1200,
        };
      }
    };
    window.addEventListener('ascii-section-change', handleSectionEvent);
    return () => window.removeEventListener('ascii-section-change', handleSectionEvent);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let rafId = 0;
    let isTabHidden = document.hidden;
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 1000 / 32; // Locks 60Hz rAF to every 2nd tick = 30 FPS

    let octaves = 3;
    let slowFrameStreak = 0;
    let fpsFrameCount = 0;
    let fpsWindowStart = performance.now();
    (window as unknown as Record<string, number>).__asciiFps = 30;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let fontSize = 8;
    let cellW = 4.8;
    let cellH = 8.5;
    let cols = 300;
    let rows = 106;
    let resolvedFontStr = '8px Consolas, "Courier New", monospace';

    let wetSandBuffer = new Float32Array(cols * rows);
    let peakRunupCol = new Float32Array(cols);
    let uColTable = new Float32Array(cols);
    let cuspSinTable = new Float32Array(cols);
    let rowCharIdx = new Uint8Array(cols);
    let rowTierIdx = new Uint8Array(cols);
    let skyCloudSample = new Float32Array(cols + 1);

    let mouseNormX = 0;
    let mouseNormY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let scrollY = window.scrollY || 0;
    let smoothScrollY = scrollY;

    let panelRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let headerRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
    let footerRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };

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

      const ftr = document.querySelector('[data-ascii-footer="true"]');
      if (ftr) {
        const fr = ftr.getBoundingClientRect();
        footerRect =
          fr.width > 10 && fr.height > 5
            ? { left: fr.left, top: fr.top, right: fr.right, bottom: fr.bottom, valid: true }
            : { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };
      } else {
        footerRect.valid = false;
      }
    };

    const setupGrid = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // High-density ASCII grid resolution: ~8px font / 8.5px row height on desktop (~300x106 grid),
      // ~7px font / 7.5px row height on mobile (~96x112 grid)
      const isSmallScreen = width < 640;
      fontSize = isSmallScreen ? 7 : 8;
      cellH = isSmallScreen ? 7.5 : 8.5;

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

      cols = Math.max(60, Math.ceil(width / cellW) + 2);
      rows = Math.max(45, Math.ceil(height / cellH) + 1);

      wetSandBuffer = new Float32Array(cols * rows);
      peakRunupCol = new Float32Array(cols);
      uColTable = new Float32Array(cols);
      cuspSinTable = new Float32Array(cols);
      rowCharIdx = new Uint8Array(cols);
      rowTierIdx = new Uint8Array(cols);
      skyCloudSample = new Float32Array(cols + 1);

      const rowScale = rows / 64;
      const initShore = Math.floor(rows * 0.68);
      const initSwash = Math.max(8, Math.floor(rows * 0.10));
      for (let c = 0; c < cols; c++) {
        const uCol = c / cols;
        uColTable[c] = uCol;
        cuspSinTable[c] = Math.sin(uCol * Math.PI * 3.0 + 0.5) * 1.6;
        const cusp = cuspSinTable[c] * rowScale;
        const maxReach = Math.floor(initShore + initSwash + cusp);
        for (let r = initShore; r <= Math.min(rows - 1, maxReach); r++) {
          const frac = 1.0 - (r - initShore) / Math.max(1, maxReach - initShore);
          wetSandBuffer[r * cols + c] = 0.18 + 0.65 * frac;
        }
      }

      measurePanel();
    };

    setupGrid();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        setupGrid();
      });
    }

    const resizeObserver = new ResizeObserver(() => measurePanel());
    const observeCurrentPanel = () => {
      resizeObserver.disconnect();
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (el) resizeObserver.observe(el);
      const hdr = document.querySelector('[data-ascii-header="true"]');
      if (hdr) resizeObserver.observe(hdr);
      const ftr = document.querySelector('[data-ascii-footer="true"]');
      if (ftr) resizeObserver.observe(ftr);
      measurePanel();
    };
    observeCurrentPanel();
    const mutationObserver = new MutationObserver(() => observeCurrentPanel());
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const onResize = () => setupGrid();
    const onScroll = () => {
      scrollY = window.scrollY || 0;
      measurePanel();
    };
    const onMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / Math.max(1, width) - 0.5) * 2;
      targetMouseY = (e.clientY / Math.max(1, height) - 0.5) * 2;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseX = (e.touches[0].clientX / Math.max(1, width) - 0.5) * 2;
        targetMouseY = (e.touches[0].clientY / Math.max(1, height) - 0.5) * 2;
      }
    };
    const onVisibilityChange = () => {
      isTabHidden = document.hidden;
      if (!isTabHidden) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(renderLoop);
      }
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    const firstCol = new Int32Array(NUM_TIERS);
    const lastCol = new Int32Array(NUM_TIERS);

    const renderLoop = (now: number) => {
      if (isTabHidden) return;
      rafId = requestAnimationFrame(renderLoop);

      if (now - lastFrameTime < FRAME_INTERVAL) return;
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

      const frameStart = performance.now();
      const t = now * 0.001;

      mouseNormX += (targetMouseX - mouseNormX) * 0.05;
      mouseNormY += (targetMouseY - mouseNormY) * 0.05;
      smoothScrollY += (scrollY - smoothScrollY) * 0.12;

      const tr = transitionRef.current;
      const elapsed = now - tr.startTime;
      const progress = tr.duration > 0 ? Math.min(1, elapsed / tr.duration) : 1;
      tr.current = lerpParams(tr.from, tr.to, progress);
      const P = tr.current;

      const isLight =
        document.documentElement.classList.contains('light') || resolvedTheme === 'light';
      const isHome = activeSecRef.current === 'home';

      ctx.clearRect(0, 0, width, height);

      const rowScale = rows / 64;
      const invRowScale = 1 / rowScale;
      const invColScale = 180 / cols;
      const scrollRowShift = (smoothScrollY / cellH) * 0.2;

      const horizonRow = Math.max(
        10,
        Math.min(
          rows - 26,
          Math.floor(
            rows * P.horizonRatio +
              mouseNormY * 1.5 * rowScale -
              Math.min(6 * rowScale, scrollRowShift * 0.25)
          )
        )
      );
      const baseShoreRow = Math.max(
        horizonRow + Math.floor(14 * rowScale),
        Math.min(
          rows - Math.floor(12 * rowScale),
          Math.floor(
            rows * P.tidePosition +
              mouseNormY * 0.8 * rowScale -
              Math.min(8 * rowScale, scrollRowShift * 0.45)
          )
        )
      );
      const swashZoneRows = Math.max(8, Math.floor(rows * 0.10));

      const horizonY = Math.min(0.85, Math.max(0.15, (horizonRow * cellH) / Math.max(1, height)));
      const shoreY = Math.min(
        0.92,
        Math.max(
          horizonY + 0.12,
          ((baseShoreRow + swashZoneRows * 0.5) * cellH) / Math.max(1, height)
        )
      );

      // Subtle atmospheric coastal color wash behind the ASCII glyphs
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isLight) {
        bgGrad.addColorStop(0.0, 'hsla(205, 42%, 84%, 0.42)');
        bgGrad.addColorStop(Math.max(0, horizonY - 0.03), 'hsla(198, 32%, 88%, 0.36)');
        bgGrad.addColorStop(horizonY, 'hsla(186, 36%, 80%, 0.40)');
        bgGrad.addColorStop(shoreY, 'hsla(182, 30%, 78%, 0.34)');
        bgGrad.addColorStop(Math.min(1, shoreY + 0.08), 'hsla(35, 38%, 80%, 0.42)');
        bgGrad.addColorStop(1.0, 'hsla(38, 45%, 82%, 0.48)');
      } else {
        bgGrad.addColorStop(0.0, 'hsla(210, 42%, 14%, 0.36)');
        bgGrad.addColorStop(Math.max(0, horizonY - 0.03), 'hsla(200, 34%, 20%, 0.32)');
        bgGrad.addColorStop(horizonY, 'hsla(188, 40%, 16%, 0.38)');
        bgGrad.addColorStop(shoreY, 'hsla(184, 34%, 15%, 0.32)');
        bgGrad.addColorStop(Math.min(1, shoreY + 0.08), 'hsla(32, 34%, 15%, 0.36)');
        bgGrad.addColorStop(1.0, 'hsla(36, 40%, 17%, 0.42)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 8 Subtle Naturalistic Coastal Color Tiers
      const tiers = isLight
        ? [
            'hsla(206, 44%, 44%, 0.38)', // 0: soft sky blue haze
            'hsla(204, 46%, 34%, 0.58)', // 1: sky blue cloud body
            'hsla(198, 42%, 24%, 0.76)', // 2: cloud tops & horizon line
            'hsla(186, 46%, 32%, 0.54)', // 3: coastal sea-green water
            'hsla(182, 50%, 22%, 0.76)', // 4: rising wave face & spray
            'hsla(190, 48%, 11%, 0.95)', // 5: crisp breaking foam (#%@)
            'hsla(28,  48%, 24%, 0.78)', // 6: dark damp umber wet-sand edge
            'hsla(36,  52%, 36%, 0.58)', // 7: warm golden-ochre dry sand
          ]
        : [
            'hsla(208, 45%, 58%, 0.38)', // 0: soft sky blue haze
            'hsla(204, 44%, 70%, 0.60)', // 1: powder-blue cloud body
            'hsla(196, 38%, 83%, 0.80)', // 2: misty cloud tops & horizon glint
            'hsla(186, 42%, 54%, 0.52)', // 3: coastal sea-green / teal swell
            'hsla(180, 44%, 72%, 0.78)', // 4: aquamarine wave curl & spray
            'hsla(46,  36%, 93%, 0.96)', // 5: warm sunlit ivory foam (#%@)
            'hsla(28,  40%, 44%, 0.56)', // 6: dark damp umber wet-sand edge
            'hsla(38,  50%, 72%, 0.70)', // 7: warm golden-ochre dry sand grain
          ];

      const driftX = t * 0.12 * P.cloudSpeed + mouseNormX * 0.45;
      const swashScale = swashZoneRows * Math.min(1.3, P.waveHeight);
      for (let c = 0; c < cols; c++) {
        const uCol = uColTable[c];
        const cusp =
          (cuspSinTable[c] +
            Math.cos(uCol * Math.PI * 6.5 - 0.7) * 0.6 +
            (valueNoise2D(uCol * 6.5 + t * 0.05, t * 0.1) - 0.5) * 1.8) *
          rowScale;

        const swashPhase =
          t * (1.25 * P.waveFreq) - uCol * Math.PI * 2.4 + Math.sin(uCol * 4.0) * 0.5;
        const surgeWave = 0.5 + 0.5 * Math.sin(swashPhase);
        const shapedSurge = surgeWave * Math.sqrt(surgeWave) * swashScale;

        peakRunupCol[c] = baseShoreRow + shapedSurge + cusp;
      }

      ctx.font = resolvedFontStr;

      const seaSpan = Math.max(1, baseShoreRow - horizonRow);
      const cloudThresh = 0.47 - 0.09 * P.cloudDensity;
      const invCloudSpan = 1.0 / (1.0 - cloudThresh);
      const falloffRadius = width < 640 ? 95 : 145;
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
          ((valueNoise2D(rNorm * 0.42 + t * 0.24, t * 0.18) - 0.5) * 2.3 +
            Math.sin(rNorm * 0.9 + t * 0.6) * 0.65) *
          rowScale;

        // Precompute row-level quantities for Sky or Sea
        let ySky = 0;
        let nySky = 0;
        let horizonHaze = 0;
        let skyVertProfile = 0;

        let depth = 0;
        let persp = 0;
        let perspCoord = 0;
        let horizonCalm = 0;

        if (r < horizonRow) {
          ySky = r / Math.max(1, horizonRow);
          nySky =
            Math.pow(ySky, 0.75) * 2.8 -
            t * 0.032 * P.cloudSpeed +
            scrollRowShift * invRowScale * 0.02;
          horizonHaze =
            ySky > 0.58
              ? Math.pow((ySky - 0.58) / 0.42, 1.8) * (0.34 + 0.22 * P.haze)
              : 0.0;
          skyVertProfile = 0.78 * P.cloudDensity * (0.30 + 0.70 * Math.sin(ySky * Math.PI * 0.88));

          // Sample domain-warped FBM at every 2nd column and linearly interpolate odd columns
          for (let c = 0; c <= cols; c += 2) {
            const uC = c / cols;
            const nx = (uC - 0.5) * 3.6 + driftX;
            const qx = fbm(nx, nySky, octaves) - 0.5;
            const qy = fbm(nx + 4.3, nySky + 2.1, octaves) - 0.5;
            const raw = fbm(nx + 1.8 * qx, nySky + 1.45 * qy, octaves);
            skyCloudSample[c] =
              raw > cloudThresh ? Math.pow((raw - cloudThresh) * invCloudSpan, 0.9) * skyVertProfile : 0.0;
          }
          for (let c = 1; c < cols; c += 2) {
            skyCloudSample[c] = 0.5 * (skyCloudSample[c - 1] + skyCloudSample[c + 1]);
          }
        } else if (r > horizonRow && r < baseShoreRow) {
          depth = (r - horizonRow) / seaSpan;
          persp = Math.pow(depth, 0.62);
          perspCoord =
            Math.pow(depth, 0.48) * 24.0 * P.waveFreq -
            t * (2.2 * P.waveFreq) -
            scrollRowShift * invRowScale * 0.28;
          horizonCalm = (1.0 - depth) * 0.34;
        }

        // Fast Y-bounding-box rejections for header, footer, and panel
        const checkHeader =
          headerRect.valid && py >= headerRect.top - 32 && py <= headerRect.bottom + 32;
        const checkFooter =
          footerRect.valid && py >= footerRect.top - 28 && py <= footerRect.bottom + 28;
        const checkPanel =
          panelRect.valid &&
          py >= panelRect.top - falloffRadius - 24 &&
          py <= panelRect.bottom + falloffRadius + 24;

        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cellW;
          const cNorm = c * invColScale;

          let panelAtten = 1.0;
          let wakeRipple = 0.0;
          let wakeFoam = 0.0;

          if (checkHeader) {
            const hd = sdRoundedBox(
              px,
              py,
              headerRect.left - 8,
              headerRect.top - 4,
              headerRect.right + 8,
              headerRect.bottom + 4,
              8
            );
            if (hd < 28) {
              panelAtten = Math.min(panelAtten, smoothstep(0, 28, Math.max(0, hd)));
            }
          }

          if (checkFooter) {
            const fd = sdRoundedBox(
              px,
              py,
              footerRect.left - 8,
              footerRect.top - 4,
              footerRect.right + 8,
              footerRect.bottom + 4,
              8
            );
            if (fd < 24) {
              panelAtten = Math.min(panelAtten, smoothstep(0, 24, Math.max(0, fd)));
            }
          }

          if (checkPanel && px <= panelRect.right + falloffRadius + 24) {
            const rawDist = sdRoundedBox(
              px,
              py,
              panelRect.left - 6,
              panelRect.top - 6,
              panelRect.right + 6,
              panelRect.bottom + 6,
              22
            );
            if (rawDist < falloffRadius + 24) {
              const boundaryNoise =
                (valueNoise2D(cNorm * 0.075 + t * 0.18, rNorm * 0.075) - 0.5) * 30.0;
              const d = rawDist + boundaryNoise;

              if (isHome) {
                if (d <= 0) {
                  panelAtten = 0.0;
                } else if (d < 85) {
                  panelAtten = Math.min(panelAtten, smoothstep(0, 85, d));
                }
              } else {
                if (d <= 0) {
                  panelAtten = 0.0;
                } else if (d < falloffRadius) {
                  const f = smoothstep(0, falloffRadius, d);
                  panelAtten = Math.min(panelAtten, f);
                  const w = 1.0 - d / falloffRadius;
                  wakeRipple = w * w * Math.sin(d * 0.16 - t * 2.6);
                  if (d > 14 && d < 58) {
                    const ring = 1.0 - Math.abs(d - 36) / 22;
                    wakeFoam =
                      Math.max(0, ring) *
                      0.46 *
                      (0.5 + 0.5 * Math.sin(cNorm * 0.22 + rNorm * 0.15 - t * 2.8));
                  }
                }
              }
            }
          }

          if (panelAtten <= 0.01) {
            rowCharIdx[c] = 0;
            continue;
          }

          let luma = 0.0;
          let tierIdx = 0;

          // LAYER 1: SKY
          if (r < horizonRow) {
            const cloudLuma = skyCloudSample[c];
            luma = Math.max(horizonHaze, cloudLuma + horizonHaze * 0.30) * P.brightness;
            luma = Math.min(0.84, luma + wakeFoam * 0.45);

            if (luma < 0.28) tierIdx = 0;
            else if (luma < 0.54) tierIdx = 1;
            else tierIdx = 2;
          }
          // LAYER 2: HORIZON
          else if (r === horizonRow) {
            const shimmer =
              0.5 +
              0.5 *
                Math.sin(cNorm * 0.11 + t * 1.1 + mouseNormX * 2.0) *
                Math.cos(cNorm * 0.04 - t * 0.7);
            luma = (0.58 + 0.22 * shimmer) * P.brightness;
            tierIdx = 2;
          }
          // LAYER 3: SEA
          else if (r > horizonRow && r < baseShoreRow) {
            const uCol = uColTable[c];
            const bendNoise =
              fbm(uCol * 3.0 - t * 0.08, depth * 2.5 - t * 0.15, 2) - 0.5;
            const lateralCurve =
              Math.sin(uCol * Math.PI * 2.2 + depth * 3.0) * 1.4 +
              Math.cos(uCol * Math.PI * 4.8 - depth * 1.8 + t * 0.35) * 0.65 +
              bendNoise * 3.6;

            const wavePhase = perspCoord + lateralCurve + wakeRipple * 2.4;

            const s1 = Math.sin(wavePhase);
            const s2 = 0.35 * Math.sin(wavePhase * 2.0 - 0.9);
            const waveHeightNorm = (s1 + s2) / 1.35;

            const crestEnvelope =
              0.52 +
              0.48 *
                valueNoise2D(
                  cNorm * 0.042 + depth * 2.8 + t * 0.14,
                  depth * 4.6 - t * 0.2
                );

            const wrapped =
              (((wavePhase - Math.PI * 0.42) % (Math.PI * 2)) + Math.PI * 3) %
                (Math.PI * 2) -
              Math.PI;
            const crestHalfWidth =
              (0.28 + 0.42 * persp) * Math.min(1.35, P.waveHeight) * crestEnvelope;

            if (
              Math.abs(wrapped) < crestHalfWidth &&
              depth > 0.10 &&
              crestEnvelope > 0.44
            ) {
              const crestCore = 1.0 - Math.abs(wrapped) / crestHalfWidth;
              const foamPatch = valueNoise2D(
                cNorm * 0.15 + t * 0.35,
                rNorm * 0.3 - t * 0.4
              );
              if (crestCore + foamPatch * 0.35 > 0.34) {
                luma = Math.min(0.99, (0.78 + 0.21 * crestCore) * P.brightness);
                tierIdx = 5;
              } else {
                luma = (0.58 + 0.18 * crestCore) * P.brightness;
                tierIdx = 4;
              }
            } else if (
              wrapped < -crestHalfWidth &&
              wrapped > -crestHalfWidth * 3.4 &&
              depth > 0.16 &&
              crestEnvelope > 0.42
            ) {
              const sprayDecay =
                1.0 - (-wrapped - crestHalfWidth) / (crestHalfWidth * 2.4);
              const sprayHash = fastHash(c + tInt4, r);
              if (sprayHash < sprayDecay * 0.62) {
                luma = (0.28 + 0.44 * sprayDecay * sprayHash) * P.brightness;
                tierIdx = luma > 0.50 ? 4 : 3;
              } else {
                luma = 0.0;
              }
            } else {
              const swellFactor = (waveHeightNorm + 1.0) * 0.5;
              if (swellFactor > 0.46) {
                luma =
                  (0.28 +
                    (swellFactor - 0.46) * 0.65 * (0.45 + 0.55 * persp) +
                    horizonCalm * 0.3) *
                  P.brightness;
                tierIdx = luma > 0.48 ? 4 : 3;
              } else if (depth < 0.28 && fastHash(c, r) > 0.35) {
                luma = (0.26 + 0.18 * (1.0 - depth / 0.28)) * P.brightness;
                tierIdx = 3;
              } else {
                const glint = fastHash(c + tInt2, r);
                luma = glint > 0.86 ? 0.22 : 0.0;
                tierIdx = 3;
              }
            }

            if (wakeFoam > 0.08) {
              luma = Math.max(luma, 0.56 + wakeFoam * 0.38);
              tierIdx = luma > 0.74 ? 5 : 4;
            }
          }
          // LAYER 4 & 5: SHORE & DRY SAND
          else {
            const cellIdx = r * cols + c;
            const runupRow = peakRunupCol[c] + rowWobble - wakeRipple * 2.0 * rowScale;
            const distFromRunup = (r - runupRow) * invRowScale;

            const highTideRow =
              baseShoreRow +
              swashZoneRows * 1.02 +
              cuspSinTable[c] * rowScale +
              rowWobble * 0.85;

            if (distFromRunup <= 0) {
              wetSandBuffer[cellIdx] = 1.0;

              if (distFromRunup > -1.7) {
                const lipCore = 1.0 - Math.abs(distFromRunup) / 1.7;
                luma = Math.min(0.99, 0.78 + 0.21 * lipCore);
                tierIdx = 5;
              } else if (distFromRunup > -3.8) {
                const h = fastHash(c + tInt4, r);
                luma = h > 0.38 ? 0.32 + 0.36 * h : 0.0;
                tierIdx = luma > 0.48 ? 4 : 3;
              } else {
                const filmNoise = valueNoise2D(cNorm * 0.12 + t * 0.3, rNorm * 0.4);
                luma = filmNoise > 0.42 ? 0.32 + 0.12 * filmNoise : 0.0;
                tierIdx = 3;
              }
            } else {
              const prevWet = wetSandBuffer[cellIdx];
              const nextWet = prevWet * 0.986;
              wetSandBuffer[cellIdx] = nextWet;

              const distToHighTide = (r - highTideRow) * invRowScale;

              if (distToHighTide <= 1.6 || nextWet > 0.12) {
                const isDarkWetEdge =
                  Math.abs(distToHighTide) < 1.6 || (nextWet > 0.14 && nextWet < 0.45);
                if (isDarkWetEdge) {
                  luma = 0.54 + 0.18 * valueNoise2D(cNorm * 0.15, rNorm * 0.3);
                } else {
                  luma = 0.32 + 0.18 * nextWet;
                }
                tierIdx = 6;
              } else {
                const worldRow = r + Math.floor(scrollRowShift);
                const h = fastHash(c, worldRow);
                const grainRipple = valueNoise2D(cNorm * 0.05, worldRow * invRowScale * 0.18);

                if (h > 0.988) {
                  luma = 0.62 + (h - 0.988) * 15.0;
                  tierIdx = 7;
                } else if (h > 0.68 - grainRipple * 0.14) {
                  luma = 0.14 + (h - 0.54) * 0.82;
                  tierIdx = 7;
                } else {
                  luma = 0.0;
                }
              }

              if (wakeFoam > 0.10) {
                luma = Math.max(luma, 0.50 + wakeFoam * 0.35);
                tierIdx = 4;
              }
            }
          }

          const dither =
            luma > 0.02 && luma < 0.78 ? (fastHash(c, r) - 0.5) * 0.075 : 0.0;
          const finalLuma = Math.max(0, Math.min(0.999, (luma + dither) * panelAtten));
          const charIdx = Math.floor(finalLuma * (RAMP_MAX + 1));

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

      const frameCost = performance.now() - frameStart;
      if (frameCost > 16) {
        slowFrameStreak++;
        if (slowFrameStreak > 8 && octaves > 2) {
          octaves = 2;
        }
      } else if (frameCost < 8 && slowFrameStreak > 0) {
        slowFrameStreak--;
      }
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 block"
    />
  );
}
