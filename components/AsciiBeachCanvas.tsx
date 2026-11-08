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
  shoreAngle: number; // Gentle diagonal/bay tilt of the coastline in top-down view
  tidePosition: number; // Mean shoreline position (~0.62–0.68 from top)
  swellSpeed: number;
  foamDensity: number;
  waveHeight: number;
  waveFreq: number;
  brightness: number;
  shallowsSpread: number;
}

export const SECTION_PRESETS: Record<BeachSectionId, SceneParams> = {
  home: {
    shoreAngle: 0.06,
    tidePosition: 0.64,
    swellSpeed: 0.90,
    foamDensity: 1.0,
    waveHeight: 1.08,
    waveFreq: 1.0,
    brightness: 1.0,
    shallowsSpread: 0.42,
  },
  projects: {
    shoreAngle: -0.05,
    tidePosition: 0.60,
    swellSpeed: 1.22,
    foamDensity: 1.18,
    waveHeight: 1.32,
    waveFreq: 1.24,
    brightness: 1.04,
    shallowsSpread: 0.46,
  },
  photography: {
    shoreAngle: 0.08,
    tidePosition: 0.65,
    swellSpeed: 0.72,
    foamDensity: 0.94,
    waveHeight: 0.94,
    waveFreq: 0.82,
    brightness: 1.15,
    shallowsSpread: 0.50,
  },
  blog: {
    shoreAngle: 0.03,
    tidePosition: 0.63,
    swellSpeed: 0.78,
    foamDensity: 1.10,
    waveHeight: 0.86,
    waveFreq: 0.90,
    brightness: 0.92,
    shallowsSpread: 0.38,
  },
  resume: {
    shoreAngle: 0.04,
    tidePosition: 0.68,
    swellSpeed: 0.52,
    foamDensity: 0.78,
    waveHeight: 0.56,
    waveFreq: 0.72,
    brightness: 0.96,
    shallowsSpread: 0.36,
  },
  experience: {
    shoreAngle: -0.03,
    tidePosition: 0.67,
    swellSpeed: 0.55,
    foamDensity: 0.82,
    waveHeight: 0.60,
    waveFreq: 0.75,
    brightness: 0.96,
    shallowsSpread: 0.38,
  },
  academics: {
    shoreAngle: 0.05,
    tidePosition: 0.68,
    swellSpeed: 0.48,
    foamDensity: 0.75,
    waveHeight: 0.52,
    waveFreq: 0.68,
    brightness: 0.94,
    shallowsSpread: 0.36,
  },
  skills: {
    shoreAngle: -0.04,
    tidePosition: 0.65,
    swellSpeed: 0.64,
    foamDensity: 0.88,
    waveHeight: 0.68,
    waveFreq: 0.80,
    brightness: 0.98,
    shallowsSpread: 0.40,
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
    shoreAngle: a.shoreAngle + (b.shoreAngle - a.shoreAngle) * e,
    tidePosition: a.tidePosition + (b.tidePosition - a.tidePosition) * e,
    swellSpeed: a.swellSpeed + (b.swellSpeed - a.swellSpeed) * e,
    foamDensity: a.foamDensity + (b.foamDensity - a.foamDensity) * e,
    waveHeight: a.waveHeight + (b.waveHeight - a.waveHeight) * e,
    waveFreq: a.waveFreq + (b.waveFreq - a.waveFreq) * e,
    brightness: a.brightness + (b.brightness - a.brightness) * e,
    shallowsSpread: a.shallowsSpread + (b.shallowsSpread - a.shallowsSpread) * e,
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
    const FRAME_INTERVAL = 1000 / 32; // 30 FPS

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
    let baseShoreCol = new Float32Array(cols);
    let peakRunupCol = new Float32Array(cols);
    let highTideCol = new Float32Array(cols);
    let uColTable = new Float32Array(cols);
    let bayArchTable = new Float32Array(cols);
    let rowCharIdx = new Uint8Array(cols);
    let rowTierIdx = new Uint8Array(cols);

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
      baseShoreCol = new Float32Array(cols);
      peakRunupCol = new Float32Array(cols);
      highTideCol = new Float32Array(cols);
      uColTable = new Float32Array(cols);
      bayArchTable = new Float32Array(cols);
      rowCharIdx = new Uint8Array(cols);
      rowTierIdx = new Uint8Array(cols);

      const rowScale = rows / 64;
      const initSwash = Math.max(9, Math.floor(rows * 0.12));

      for (let c = 0; c < cols; c++) {
        const uCol = c / cols;
        uColTable[c] = uCol;
        // Gentle coastal bay curve + natural scalloped beach cusps
        const arch =
          Math.sin(uCol * Math.PI) * 0.045 +
          Math.sin(uCol * Math.PI * 3.2 + 0.4) * 0.024 +
          Math.cos(uCol * Math.PI * 6.4 - 0.7) * 0.010;
        bayArchTable[c] = arch;

        const initShore = Math.floor(rows * (0.64 + arch + (uCol - 0.5) * 0.06));
        const maxReach = Math.floor(initShore + initSwash);
        for (let r = initShore; r <= Math.min(rows - 1, maxReach); r++) {
          const frac = 1.0 - (r - initShore) / Math.max(1, maxReach - initShore);
          wetSandBuffer[r * cols + c] = 0.20 + 0.65 * frac;
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
      const scrollRowShift = (smoothScrollY / cellH) * 0.25;

      const swashZoneRows = Math.max(9, Math.floor(rows * 0.125));
      const swashScale = swashZoneRows * Math.min(1.35, P.waveHeight);

      // Compute top-down shoreline contour & scalloped swash tongues across columns
      for (let c = 0; c < cols; c++) {
        const uCol = uColTable[c];
        // Coastline contour: sweeping bay curve + subtle tilt + slow organic drift
        const shoreRatio =
          P.tidePosition +
          bayArchTable[c] +
          (uCol - 0.5) * (P.shoreAngle + mouseNormX * 0.03) +
          (valueNoise2D(uCol * 5.0 + t * 0.04, t * 0.08) - 0.5) * 0.025;

        const bRow = Math.max(
          Math.floor(rows * 0.28),
          Math.min(
            rows - Math.floor(14 * rowScale),
            rows * shoreRatio + mouseNormY * 1.2 * rowScale - scrollRowShift * 0.35
          )
        );
        baseShoreCol[c] = bRow;

        // Overlapping scalloped swash tongues (beach cusps) surging up the shore
        const tongue1 = 0.5 + 0.5 * Math.sin(t * (1.15 * P.waveFreq) - uCol * Math.PI * 2.6);
        const tongue2 =
          0.5 + 0.5 * Math.sin(t * (0.85 * P.waveFreq) + uCol * Math.PI * 3.8 + 1.4);
        const combinedSurge = 0.65 * Math.pow(tongue1, 1.35) + 0.35 * Math.pow(tongue2, 1.5);

        peakRunupCol[c] = bRow + combinedSurge * swashScale;
        highTideCol[c] = bRow + swashScale * 0.98;
      }

      const meanShoreY = Math.min(
        0.88,
        Math.max(0.35, ((rows * P.tidePosition + swashZoneRows * 0.4) * cellH) / Math.max(1, height))
      );

      // Top-down aerial coastal wash:
      // Deep Ocean Blue-Teal (top) -> Turquoise Shallows & Surf Zone -> Damp Bronze Wet Sand -> Golden Dry Sand (bottom)
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

      // In Light Mode, add a soft feathered readability veil behind the active text column
      // so dark typography stays 100% crisp over the top-down ocean & sand
      if (isLight && panelRect.valid) {
        const cx = (panelRect.left + panelRect.right) * 0.5;
        const cy = (panelRect.top + panelRect.bottom) * 0.5;
        const rx = Math.max(260, (panelRect.right - panelRect.left) * 0.85 + 140);
        const ry = Math.max(180, (panelRect.bottom - panelRect.top) * 0.75 + 120);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        const veil = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
        veil.addColorStop(0, 'hsla(42, 30%, 96%, 0.62)');
        veil.addColorStop(0.65, 'hsla(42, 28%, 95%, 0.34)');
        veil.addColorStop(1, 'hsla(42, 28%, 95%, 0.0)');
        ctx.fillStyle = veil;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 8 Top-Down Coastal Color Tiers:
      // 0: Deep ocean swells & caustics (Deep Indigo-Teal)
      // 1: Mid-ocean swell face (Cerulean-Teal)
      // 2: Turquoise shallows & shoaling water ripples (Luminous Sea-Green / Aquamarine)
      // 3: Wave-front trough shadow (Deep Ocean Teal shadow immediately in front of breaking crest)
      // 4: Cellular / lacy foam wake & collapsing spray behind crests (Soft Seafoam / Aqua-White)
      // 5: Breaking wave crest foam & scalloped swash lip (Crisp Bright White / Ivory `#%@`)
      // 6: Dark glistening wet-sand band & scalloped tide mark (Rich Damp Umber / Bronze)
      // 7: Dry sunlit golden sand grain, wind ripples & shells (Warm Golden Ochre)
      const tiers = isLight
        ? [
            'hsla(202, 46%, 34%, 0.44)', // 0: deep ocean caustics
            'hsla(194, 48%, 30%, 0.56)', // 1: mid-ocean swell
            'hsla(186, 48%, 28%, 0.54)', // 2: turquoise shallows ripples
            'hsla(192, 54%, 20%, 0.78)', // 3: deep wave-front shadow under breaking crest
            'hsla(180, 40%, 94%, 0.78)', // 4: lacy cellular foam wake & spray
            'hsla(48,  65%, 99%, 0.98)', // 5: crisp bright white breaking surf & swash lip (#%@)
            'hsla(28,  46%, 26%, 0.74)', // 6: dark damp umber wet-sand band & tide line
            'hsla(34,  48%, 36%, 0.62)', // 7: warm golden-ochre dry sand grain
          ]
        : [
            'hsla(204, 48%, 48%, 0.36)', // 0: deep ocean swells & caustics
            'hsla(194, 46%, 58%, 0.50)', // 1: mid-ocean swell face
            'hsla(184, 45%, 64%, 0.58)', // 2: turquoise shallows
            'hsla(192, 42%, 38%, 0.46)', // 3: wave trough shadow
            'hsla(178, 42%, 80%, 0.78)', // 4: lacy cellular foam wake & spray
            'hsla(46,  38%, 95%, 0.97)', // 5: bright ivory breaking surf & swash lip (#%@)
            'hsla(28,  40%, 44%, 0.58)', // 6: dark damp umber wet-sand band & tide line
            'hsla(38,  50%, 72%, 0.70)', // 7: warm golden-ochre dry sand grain
          ];

      ctx.font = resolvedFontStr;

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
          ((valueNoise2D(rNorm * 0.42 + t * 0.24, t * 0.18) - 0.5) * 2.2 +
            Math.sin(rNorm * 0.9 + t * 0.6) * 0.65) *
          rowScale;

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
                      0.48 *
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

          const shoreRow = baseShoreCol[c];

          // ==================================================================
          // TOP-DOWN OCEAN & SURF ZONE (r < shoreRow)
          // ==================================================================
          if (r < shoreRow) {
            // uWater = 0.0 at top (deep water) -> 1.0 at shoreLine (shoaling surf)
            const uWater = Math.max(0, Math.min(1, r / Math.max(1, shoreRow)));
            const uCol = uColTable[c];

            // In top-down view, wave wavelength compresses slightly as waves shoal into shallow water
            const shoalCoord = Math.pow(uWater, 0.78) * 28.0 * P.waveFreq;

            // Organic wave refraction along the curved bay contour
            const refractNoise =
              fbm(uCol * 2.8 - t * 0.06, uWater * 2.4 - t * 0.14, 2) - 0.5;
            const lateralBend =
              Math.sin(uCol * Math.PI * 2.0 + uWater * 2.2) * 1.1 +
              Math.cos(uCol * Math.PI * 4.5 - uWater * 1.6 + t * 0.3) * 0.55 +
              refractNoise * 3.4;

            const wavePhase =
              shoalCoord -
              t * (2.15 * P.waveFreq * P.swellSpeed) +
              lateralBend -
              scrollRowShift * invRowScale * 0.25 +
              wakeRipple * 2.4;

            const s1 = Math.sin(wavePhase);
            const s2 = 0.38 * Math.sin(wavePhase * 2.0 - 0.85);
            const waveHeightNorm = (s1 + s2) / 1.38;

            // Lateral wave set envelope so surf lines form natural coastal wave groups
            const crestEnvelope =
              0.48 +
              0.52 *
                valueNoise2D(
                  cNorm * 0.038 + uWater * 2.4 + t * 0.12,
                  uWater * 4.2 - t * 0.18
                );

            // Wrapped phase around each wave peak (0 = breaking crest lip, < 0 = trailing wake, > 0 = front trough)
            const wrapped =
              (((wavePhase - Math.PI * 0.42) % (Math.PI * 2)) + Math.PI * 3) %
                (Math.PI * 2) -
              Math.PI;

            const shoalIntensity = smoothstep(0.10, 0.85, uWater);
            const crestHalfWidth =
              (0.22 + 0.44 * shoalIntensity) *
              Math.min(1.35, P.waveHeight) *
              crestEnvelope;

            if (
              Math.abs(wrapped) < crestHalfWidth &&
              uWater > 0.12 &&
              crestEnvelope > 0.44
            ) {
              // Breaking wave crest seen from top-down: thick, curving bright white foam line (* # % @)
              const crestCore = 1.0 - Math.abs(wrapped) / crestHalfWidth;
              const foamPatch = valueNoise2D(
                cNorm * 0.15 + t * 0.3,
                rNorm * 0.28 - t * 0.35
              );
              if (crestCore + foamPatch * 0.35 > 0.32) {
                luma = Math.min(0.99, (0.78 + 0.21 * crestCore) * P.brightness);
                tierIdx = 5; // Crisp white surf foam
              } else {
                luma = (0.58 + 0.18 * crestCore) * P.brightness;
                tierIdx = 4; // Lacy seafoam wake
              }
            } else if (
              wrapped < -crestHalfWidth &&
              wrapped > -crestHalfWidth * (2.6 + 2.2 * shoalIntensity) &&
              uWater > 0.16 &&
              crestEnvelope > 0.42
            ) {
              // Top-down cellular/lacy foam wake trailing behind the breaking wave crest
              const wakeSpan = crestHalfWidth * (1.6 + 2.2 * shoalIntensity);
              const wakeDecay = 1.0 - (-wrapped - crestHalfWidth) / Math.max(0.01, wakeSpan);
              const cellWeb = valueNoise2D(cNorm * 0.22 + t * 0.2, rNorm * 0.32 - t * 0.3);
              const sprayHash = fastHash(c + tInt4, r);

              if (cellWeb > 0.56 - wakeDecay * 0.28 && sprayHash < wakeDecay * 0.78 * P.foamDensity) {
                luma = (0.32 + 0.46 * wakeDecay * cellWeb) * P.brightness;
                tierIdx = 4; // Cellular white/aqua foam wake
              } else {
                luma = (0.20 + 0.16 * shoalIntensity) * P.brightness;
                tierIdx = uWater > 0.45 ? 2 : 1;
              }
            } else if (
              wrapped > crestHalfWidth &&
              wrapped < crestHalfWidth * 2.2 &&
              uWater > 0.14 &&
              crestEnvelope > 0.44
            ) {
              // Steep wave face / trough shadow immediately in front of the breaking crest
              const shadowFactor = 1.0 - (wrapped - crestHalfWidth) / (crestHalfWidth * 1.2);
              luma = (0.30 + 0.36 * shadowFactor * shoalIntensity) * P.brightness;
              tierIdx = 3; // Deep wave-front shadow
            } else {
              // Unbroken top-down ocean swells & caustics (deep ocean at top -> turquoise shallows)
              const swellFactor = (waveHeightNorm + 1.0) * 0.5;
              const caustic = valueNoise2D(cNorm * 0.14 + t * 0.25, rNorm * 0.22 - t * 0.2);

              if (swellFactor > 0.48) {
                luma =
                  (0.24 + (swellFactor - 0.48) * 0.62 * (0.4 + 0.6 * shoalIntensity)) *
                  P.brightness;
                tierIdx = uWater > 0.52 ? 2 : uWater > 0.24 ? 1 : 0;
              } else if (caustic > 0.66) {
                luma = (0.18 + (caustic - 0.66) * 0.55) * P.brightness;
                tierIdx = uWater > 0.50 ? 2 : 0;
              } else {
                const glint = fastHash(c + tInt2, r);
                luma = glint > 0.89 ? 0.20 : 0.0;
                tierIdx = uWater > 0.50 ? 2 : 0;
              }
            }

            if (wakeFoam > 0.08) {
              luma = Math.max(luma, 0.56 + wakeFoam * 0.38);
              tierIdx = luma > 0.74 ? 5 : 4;
            }
          }
          // ==================================================================
          // TOP-DOWN SHORE (Scalloped Swash + Glistening Wet Sand) & DRY SAND
          // ==================================================================
          else {
            const cellIdx = r * cols + c;
            const runupRow = peakRunupCol[c] + rowWobble - wakeRipple * 2.0 * rowScale;
            const distFromRunup = (r - runupRow) * invRowScale;
            const highTideRow = highTideCol[c] + rowWobble * 0.85;

            if (distFromRunup <= 0) {
              // Scalloped swash wave sheet actively surging over the sand
              wetSandBuffer[cellIdx] = 1.0;

              if (distFromRunup > -1.8) {
                // Thick bright white foam lip at the leading edge of the swash tongue (* # % @)
                const lipCore = 1.0 - Math.abs(distFromRunup) / 1.8;
                luma = Math.min(0.99, 0.78 + 0.21 * lipCore);
                tierIdx = 5;
              } else if (distFromRunup > -4.5) {
                // Lacy cellular foam web trailing inside the swash tongue
                const h = fastHash(c + tInt4, r);
                const lace = valueNoise2D(cNorm * 0.2 + t * 0.25, rNorm * 0.35);
                luma = h > 0.36 && lace > 0.38 ? 0.36 + 0.38 * h : 0.0;
                tierIdx = luma > 0.46 ? 4 : 2;
              } else {
                // Thin glassy turquoise water film over wet sand
                const filmNoise = valueNoise2D(cNorm * 0.12 + t * 0.3, rNorm * 0.35);
                luma = filmNoise > 0.44 ? 0.28 + 0.14 * filmNoise : 0.0;
                tierIdx = 2;
              }
            } else {
              // Above the current swash tongue: wet sand glistens and slowly fades
              const prevWet = wetSandBuffer[cellIdx];
              const nextWet = prevWet * 0.986;
              wetSandBuffer[cellIdx] = nextWet;

              const distToHighTide = (r - highTideRow) * invRowScale;

              if (distToHighTide <= 1.8 || nextWet > 0.12) {
                // DARK GLISTENING WET-SAND BAND & SCALLOPED TIDE EDGE (Umber Tier 6)
                const isDarkWetEdge =
                  Math.abs(distToHighTide) < 1.7 || (nextWet > 0.14 && nextWet < 0.45);
                if (isDarkWetEdge) {
                  luma = 0.54 + 0.18 * valueNoise2D(cNorm * 0.15, rNorm * 0.3);
                } else {
                  luma = 0.30 + 0.20 * nextWet;
                }
                tierIdx = 6;
              } else {
                // TOP-DOWN DRY SAND (Golden-ochre sand ripples, fine sparse grain & shells)
                const worldRow = r + Math.floor(scrollRowShift);
                const h = fastHash(c, worldRow);
                // Subtle wind-blown sand ripple contours parallel to the beach
                const windRipple =
                  Math.sin(
                    (r - highTideRow) * invRowScale * 1.35 +
                      Math.sin(cNorm * 0.06) * 1.5
                  ) * 0.08;
                const grainNoise =
                  valueNoise2D(cNorm * 0.05, worldRow * invRowScale * 0.18) + windRipple;

                if (h > 0.987) {
                  // Small shell, pebble, or driftwood speck (+ * #)
                  luma = 0.62 + (h - 0.987) * 15.0;
                  tierIdx = 7;
                } else if (h > 0.66 - grainNoise * 0.16) {
                  // Fine golden dry sand grain (. , : ; -)
                  luma = 0.15 + (h - 0.52) * 0.82;
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
