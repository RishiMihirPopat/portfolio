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
  horizonRatio: number;   // 0..1 vertical position of horizon
  cloudSpeed: number;     // horizontal/vertical drift multiplier
  cloudDensity: number;   // cloud coverage & contrast multiplier
  waveHeight: number;     // swell height & breaking intensity
  waveFreq: number;       // number of wave bands
  tidePosition: number;   // 0..1 vertical position where surf meets wet sand
  brightness: number;     // overall character density multiplier
  haze: number;           // atmospheric haze above horizon
}

export const SECTION_PRESETS: Record<BeachSectionId, SceneParams> = {
  home: {
    horizonRatio: 0.38,
    cloudSpeed: 0.85,
    cloudDensity: 0.95,
    waveHeight: 1.0,
    waveFreq: 1.0,
    tidePosition: 0.72,
    brightness: 1.0,
    haze: 0.28,
  },
  projects: {
    horizonRatio: 0.28,
    cloudSpeed: 1.35,
    cloudDensity: 1.08,
    waveHeight: 1.38,
    waveFreq: 1.35,
    tidePosition: 0.70,
    brightness: 1.05,
    haze: 0.22,
  },
  photography: {
    horizonRatio: 0.35,
    cloudSpeed: 0.65,
    cloudDensity: 0.82,
    waveHeight: 0.82,
    waveFreq: 0.72,
    tidePosition: 0.74,
    brightness: 1.26,
    haze: 0.38,
  },
  blog: {
    horizonRatio: 0.33,
    cloudSpeed: 0.75,
    cloudDensity: 1.32,
    waveHeight: 0.75,
    waveFreq: 0.88,
    tidePosition: 0.71,
    brightness: 0.82,
    haze: 0.52,
  },
  resume: {
    horizonRatio: 0.40,
    cloudSpeed: 0.38,
    cloudDensity: 0.78,
    waveHeight: 0.34,
    waveFreq: 0.62,
    tidePosition: 0.76,
    brightness: 0.92,
    haze: 0.32,
  },
  experience: {
    horizonRatio: 0.39,
    cloudSpeed: 0.42,
    cloudDensity: 0.80,
    waveHeight: 0.38,
    waveFreq: 0.66,
    tidePosition: 0.75,
    brightness: 0.94,
    haze: 0.30,
  },
  academics: {
    horizonRatio: 0.41,
    cloudSpeed: 0.35,
    cloudDensity: 0.76,
    waveHeight: 0.32,
    waveFreq: 0.60,
    tidePosition: 0.76,
    brightness: 0.92,
    haze: 0.34,
  },
  skills: {
    horizonRatio: 0.37,
    cloudSpeed: 0.48,
    cloudDensity: 0.85,
    waveHeight: 0.42,
    waveFreq: 0.70,
    tidePosition: 0.74,
    brightness: 0.96,
    haze: 0.28,
  },
};

// Standard character ramp ordered from empty (0) to densest (9)
const RAMP_DARK = ' .:-=+*#%@';
// Inverted character ramp for light mode where brightness = sparse characters
const RAMP_LIGHT = '@%#*+=-:. ';

// Fast deterministic 2D Value Noise with precomputed 512-entry permutation table
const PERM = new Uint8Array(512);
const VALS = new Float32Array(256);
(() => {
  let seed = 1337420;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    VALS[i] = (seed & 0xffff) / 0xffff;
  }
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
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

  // Smoothstep
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
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, y * freq);
    norm += amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return value / norm;
}

function fastHash(c: number, r: number): number {
  let n = (c * 374761393 + r * 668265263) ^ 0x5bf03635;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpParams(a: SceneParams, b: SceneParams, t: number): SceneParams {
  const e = easeInOutCubic(Math.max(0, Math.min(1, t)));
  return {
    horizonRatio: a.horizonRatio + (b.horizonRatio - a.horizonRatio) * e,
    cloudSpeed: a.cloudSpeed + (b.cloudSpeed - a.cloudSpeed) * e,
    cloudDensity: a.cloudDensity + (b.cloudDensity - a.cloudDensity) * e,
    waveHeight: a.waveHeight + (b.waveHeight - a.waveHeight) * e,
    waveFreq: a.waveFreq + (b.waveFreq - a.waveFreq) * e,
    tidePosition: a.tidePosition + (b.tidePosition - a.tidePosition) * e,
    brightness: a.brightness + (b.brightness - a.brightness) * e,
    haze: a.haze + (b.haze - a.haze) * e,
  };
}

// Signed distance from point (px, py) to a rounded box
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

interface AsciiBeachCanvasProps {
  activeSection?: BeachSectionId;
}

export function AsciiBeachCanvas({ activeSection = 'home' }: AsciiBeachCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  // Keep mutable transition state in ref so animation loop doesn't restart
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
    const target = SECTION_PRESETS[activeSection] || SECTION_PRESETS.home;
    transitionRef.current = {
      from: { ...transitionRef.current.current },
      to: target,
      current: { ...transitionRef.current.current },
      startTime: performance.now(),
      duration: 1200,
    };
  }, [activeSection]);

  // Also listen for custom 'ascii-section-change' events dispatched by hash navigation
  useEffect(() => {
    const handleSectionEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<BeachSectionId>;
      const sec = customEv.detail;
      if (sec && SECTION_PRESETS[sec]) {
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
    const FRAME_INTERVAL = 1000 / 30; // 30 FPS cap

    // Adaptive quality state
    let octaves = 3;
    let slowFrameStreak = 0;
    let resolutionScale = 1.0;

    // Grid dimensions & wet-sand memory buffer
    let width = window.innerWidth;
    let height = window.innerHeight;
    let cellW = 9;
    let cellH = 16;
    let cols = 100;
    let rows = 50;
    let wetSandBuffer = new Float32Array(cols * rows);
    let peakRunupCol = new Float32Array(cols);

    // Camera parallax & cursor state
    let mouseNormX = 0;
    let mouseNormY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let scrollY = window.scrollY || 0;
    let smoothScrollY = scrollY;

    // Active content panel bounding box
    let panelRect = { left: -9999, top: -9999, right: -9999, bottom: -9999, valid: false };

    const measurePanel = () => {
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (!el) {
        panelRect.valid = false;
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        panelRect = {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          valid: true,
        };
      } else {
        panelRect.valid = false;
      }
    };

    const setupGrid = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const isSmallScreen = width < 640;
      const baseCellW = (isSmallScreen ? 10.5 : 8.6) * resolutionScale;
      const baseCellH = (isSmallScreen ? 18 : 15) * resolutionScale;

      cellW = baseCellW;
      cellH = baseCellH;
      cols = Math.max(30, Math.ceil(width / cellW));
      rows = Math.max(20, Math.ceil(height / cellH));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontSize = Math.round(cellH * 0.88);
      ctx.font = `${fontSize}px var(--font-mono), "JetBrains Mono", "Courier New", monospace`;
      ctx.textBaseline = 'top';

      wetSandBuffer = new Float32Array(cols * rows);
      peakRunupCol = new Float32Array(cols);
      measurePanel();
    };

    setupGrid();

    // Observe content panel size changes
    const resizeObserver = new ResizeObserver(() => {
      measurePanel();
    });
    const observeCurrentPanel = () => {
      resizeObserver.disconnect();
      const el = document.querySelector('[data-ascii-panel="true"]');
      if (el) resizeObserver.observe(el);
      measurePanel();
    };
    observeCurrentPanel();
    const mutationObserver = new MutationObserver(() => {
      observeCurrentPanel();
    });
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

    const renderLoop = (now: number) => {
      if (isTabHidden) return;
      rafId = requestAnimationFrame(renderLoop);

      if (now - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = now;

      const frameStart = performance.now();
      const t = now * 0.001;

      // Smooth camera & cursor inputs
      mouseNormX += (targetMouseX - mouseNormX) * 0.06;
      mouseNormY += (targetMouseY - mouseNormY) * 0.06;
      smoothScrollY += (scrollY - smoothScrollY) * 0.12;

      // Interpolate route parameters over 1.2s
      const tr = transitionRef.current;
      const elapsed = now - tr.startTime;
      const progress = tr.duration > 0 ? Math.min(1, elapsed / tr.duration) : 1;
      tr.current = lerpParams(tr.from, tr.to, progress);
      const P = tr.current;

      // Determine theme mode (dark vs light)
      const isLight =
        document.documentElement.classList.contains('light') || resolvedTheme === 'light';
      const ramp = isLight ? RAMP_LIGHT : RAMP_DARK;
      const rampMax = ramp.length - 1;

      // Clear viewport
      ctx.clearRect(0, 0, width, height);

      // Single-hue ink palette (base layer + foam/highlight layer)
      const baseColor = isLight ? 'rgba(34, 40, 48, 0.36)' : 'rgba(158, 172, 188, 0.36)';
      const highlightColor = isLight ? 'rgba(15, 20, 26, 0.72)' : 'rgba(226, 236, 245, 0.78)';

      // Parallax offsets from scroll and cursor
      const scrollRowShift = (smoothScrollY / cellH) * 0.18;
      const horizonRow = Math.floor(
        rows * P.horizonRatio + mouseNormY * 1.6 - Math.min(4, scrollRowShift * 0.25)
      );
      const baseShoreRow = Math.floor(
        rows * P.tidePosition + mouseNormY * 0.8 - Math.min(5, scrollRowShift * 0.45)
      );
      const swashZoneRows = Math.max(4, Math.floor(rows * 0.11));
      const drySandStartRow = baseShoreRow + swashZoneRows;

      // Precompute column-wise wave run-up along the shore
      const driftX = t * 0.22 * P.cloudSpeed + mouseNormX * 0.8;
      for (let c = 0; c < cols; c++) {
        const colWobble =
          Math.sin(c * 0.09 + t * 0.45) * 0.9 +
          (valueNoise2D(c * 0.05 + t * 0.12, t * 0.2) - 0.5) * 2.2;
        // Swash oscillation: primary surf cycle + secondary slow set wave
        const surfCycle =
          0.5 +
          0.5 *
            Math.sin(
              t * (1.25 * P.waveFreq) -
                c * 0.035 +
                Math.sin(c * 0.04 + t * 0.3) * 0.8
            );
        const surge = Math.pow(surfCycle, 1.7) * swashZoneRows * Math.min(1.35, P.waveHeight);
        peakRunupCol[c] = baseShoreRow + surge + colWobble;
      }

      // Font metric adjustments
      const fontSize = Math.round(cellH * 0.88);
      ctx.font = `${fontSize}px var(--font-mono), "JetBrains Mono", "Courier New", monospace`;

      // Render row by row using batched fillText strings (max 2 fillText calls per row)
      for (let r = 0; r < rows; r++) {
        let baseRowStr = '';
        let highRowStr = '';
        let hasBase = false;
        let hasHigh = false;

        const py = (r + 0.5) * cellH;
        const rowWobble = Math.sin(r * 0.7 + t * 0.8) * 0.45;

        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cellW;

          // 1. Check content panel interaction (bounding box SDF)
          let panelInside = false;
          let panelDist = 9999;
          if (panelRect.valid) {
            panelDist = sdRoundedBox(
              px,
              py,
              panelRect.left - 8,
              panelRect.top - 8,
              panelRect.right + 8,
              panelRect.bottom + 8,
              12
            );
            if (panelDist < 0) {
              panelInside = true;
            }
          }

          // Inside the active content panel: thin out characters strongly so text stays crisp
          if (panelInside) {
            // Very near the inner edge (-14px..0px), allow rare faint dots
            if (panelDist > -12 && ((c + r) & 7) === 0) {
              baseRowStr += '.';
              highRowStr += ' ';
              hasBase = true;
            } else {
              baseRowStr += ' ';
              highRowStr += ' ';
            }
            continue;
          }

          // Boundary wake around the content panel (0 .. 34px outside the panel)
          let wakeFactor = 0;
          let wakeRipple = 0;
          if (panelDist >= 0 && panelDist < 34) {
            wakeFactor = 1 - panelDist / 34;
            wakeRipple =
              wakeFactor *
              wakeFactor *
              Math.sin(panelDist * 0.45 - t * 3.4 + (c - r) * 0.25);
          }

          let baseChar = ' ';
          let highChar = ' ';

          // ==================================================================
          // LAYER 1: SKY (Domain-warped fractal clouds)
          // ==================================================================
          if (r < horizonRow) {
            const skyNormY = r / Math.max(1, horizonRow); // 0 at top, 1 at horizon
            const nx = (c / cols) * 3.4 + driftX + wakeRipple * 0.15;
            const ny = skyNormY * 1.9 - t * 0.035 * P.cloudSpeed + scrollRowShift * 0.02;

            // Domain warp q
            const qx = fbm(nx, ny, octaves) - 0.5;
            const qy = fbm(nx + 5.2, ny + 1.3, octaves) - 0.5;
            const cloudVal = fbm(nx + 1.75 * qx, ny + 1.35 * qy, octaves);

            // Horizon haze blends sky toward soft mid-density near the horizon
            const horizonProximity = Math.pow(skyNormY, 2.6);
            const hazeBlend = horizonProximity * P.haze;

            let density =
              (cloudVal - (0.46 - 0.12 * P.cloudDensity)) * 2.1 * P.cloudDensity;
            density = density * (1 - hazeBlend * 0.55) + hazeBlend * 0.42;
            density *= P.brightness;

            if (wakeFactor > 0.35 && Math.abs(wakeRipple) > 0.18) {
              // Subtle air current parting around panel in sky
              highChar = wakeFactor > 0.65 ? ':' : '.';
            } else if (density > 0.06) {
              const idx = Math.max(
                1,
                Math.min(rampMax, Math.floor(density * rampMax))
              );
              baseChar = ramp[idx];
              // Golden-hour / bright cloud tops get a subtle highlight character
              if (density > 0.78 && P.brightness > 1.05) {
                highChar = isLight ? ':' : '*';
              }
            }
          }
          // ==================================================================
          // LAYER 2: HORIZON (Thin brighter seam with faint haze)
          // ==================================================================
          else if (r === horizonRow) {
            const shimmer = Math.sin(c * 0.18 + t * 1.4 + mouseNormX * 3);
            highChar = shimmer > 0.35 ? '=' : shimmer > -0.35 ? '-' : '~';
          }
          // ==================================================================
          // LAYER 3: SEA (Perspective swells, curling crests, foam & spray)
          // ==================================================================
          else if (r > horizonRow && r < baseShoreRow) {
            const seaSpan = Math.max(1, baseShoreRow - horizonRow);
            const depth = (r - horizonRow) / seaSpan; // 0 at horizon -> 1 at shore
            // Perspective foreshortening: waves near horizon are compressed, near viewer are wide & fast
            const persp = Math.pow(depth, 0.58);
            const invDepth = 1 / (0.16 + 0.84 * depth);

            // Deflect wave phase around the content panel like water around a rock
            const panelPhaseDeflect = wakeFactor * 2.4;

            const waveNoise =
              valueNoise2D(c * 0.045 - t * 0.18, depth * 4.5 - t * 0.35) - 0.5;
            const phase =
              invDepth * 6.8 * P.waveFreq -
              t * (2.2 + 0.6 * P.waveFreq) -
              scrollRowShift * 0.35 +
              Math.sin(c * 0.04 + r * 0.15) * 0.55 +
              waveNoise * 1.6 +
              panelPhaseDeflect;

            // Asymmetric Stokes wave profile that steepens as depth -> 1
            const primary = Math.sin(phase);
            const harmonic = Math.sin(2 * phase - 0.55) * (0.28 + 0.32 * depth);
            const swell = (primary + harmonic) * P.waveHeight * (0.45 + 0.65 * persp);

            const crestThreshold = 0.72 / Math.max(0.5, P.waveHeight);

            // Foam wrap right at the content panel rock boundary
            if (wakeFactor > 0.45) {
              const rockFoam = Math.sin(panelDist * 0.5 - t * 4.5 + c * 0.3);
              if (wakeFactor > 0.72 || rockFoam > 0.25) {
                highChar = wakeFactor > 0.8 ? '*' : '~';
              } else {
                baseChar = ':';
              }
            } else if (swell > crestThreshold && depth > 0.22) {
              // Wave crest curling and breaking into dense foam (# @ *)
              const curlIntensity = (swell - crestThreshold) / 0.65;
              if (curlIntensity > 0.55) {
                highChar = (c + r) % 2 === 0 ? '@' : '#';
              } else {
                highChar = '*';
              }
            } else if (
              swell > crestThreshold * 0.68 &&
              Math.cos(phase) < 0 &&
              depth > 0.32
            ) {
              // Collapsing spray immediately behind/downwind of breaking crest (. , ' `)
              const sprayPick = (c * 7 + r * 13 + Math.floor(t * 8)) & 3;
              highChar = sprayPick === 0 ? '.' : sprayPick === 1 ? ',' : sprayPick === 2 ? "'" : '`';
            } else {
              // Swell body striations
              const waterDensity = Math.max(
                0,
                Math.min(
                  1,
                  (0.28 + 0.38 * (swell * 0.5 + 0.5) + 0.12 * depth) * P.brightness
                )
              );
              const idx = Math.floor(waterDensity * (rampMax - 2));
              if (idx > 0) {
                baseChar = ramp[idx];
              }
            }
          }
          // ==================================================================
          // LAYER 4 & 5: SHORE (Wet-sand swash zone) & DRY SAND (Foreground)
          // ==================================================================
          else {
            const cellIdx = r * cols + c;
            const runupRow = peakRunupCol[c] + rowWobble - wakeFactor * 2.2;
            const distFromRunup = r - runupRow;

            if (distFromRunup <= 0) {
              // Wave swash is currently covering this sand cell
              wetSandBuffer[cellIdx] = 1.0;
              if (distFromRunup > -1.4) {
                // Lacy leading foam edge of the swash
                highChar = (c + Math.floor(t * 6)) % 3 === 0 ? '*' : '~';
              } else if (distFromRunup > -3.0) {
                // Collapsing swash spray
                highChar = (c + r) % 2 === 0 ? '.' : "'";
              } else {
                baseChar = isLight ? '=' : ':';
              }
            } else {
              // Wave has retreated above this row — slowly evaporate wet sand
              const prevWet = wetSandBuffer[cellIdx];
              const nextWet = prevWet * 0.985;
              wetSandBuffer[cellIdx] = nextWet;

              // Foam deflection around content panel on the beach
              if (wakeFactor > 0.55 && r < drySandStartRow + 3) {
                highChar = wakeFactor > 0.78 ? '~' : '.';
              } else if (nextWet > 0.12) {
                // Wet sand band: denser near the high-water mark edge, slowly fading
                const edgeAccent = nextWet > 0.72 ? 0.25 : 0;
                const wetDensity = Math.min(0.85, (nextWet * 0.55 + edgeAccent) * P.brightness);
                const idx = Math.max(1, Math.min(rampMax - 2, Math.floor(wetDensity * rampMax)));
                baseChar = ramp[idx];
              } else {
                // LAYER 5: DRY SAND (Sparse grainy texture + static pebbles / driftwood)
                const worldRow = r + Math.floor(scrollRowShift);
                const h = fastHash(c, worldRow);
                const hNext = fastHash(c - 1, worldRow);

                if (h > 0.9965) {
                  // Static pebble
                  baseChar = 'o';
                } else if (h > 0.993 || (hNext > 0.993 && h > 0.5)) {
                  // Small static driftwood fragment
                  baseChar = h > 0.995 ? '=' : '~';
                } else if (h > 0.945) {
                  // Sparse dry sand grain
                  baseChar = h > 0.975 ? ':' : h > 0.96 ? ',' : '.';
                }
              }
            }
          }

          if (highChar !== ' ') {
            highRowStr += highChar;
            baseRowStr += ' ';
            hasHigh = true;
          } else if (baseChar !== ' ') {
            baseRowStr += baseChar;
            highRowStr += ' ';
            hasBase = true;
          } else {
            baseRowStr += ' ';
            highRowStr += ' ';
          }
        }

        const yPos = r * cellH;
        if (hasBase) {
          ctx.fillStyle = baseColor;
          ctx.fillText(baseRowStr, 0, yPos);
        }
        if (hasHigh) {
          ctx.fillStyle = highlightColor;
          ctx.fillText(highRowStr, 0, yPos);
        }
      }

      // Adaptive performance guard: if per-cell noise exceeds frame budget, simplify octaves
      const frameCost = performance.now() - frameStart;
      if (frameCost > 16) {
        slowFrameStreak++;
        if (slowFrameStreak > 12 && octaves > 2) {
          octaves = 2;
        }
        if (slowFrameStreak > 28 && resolutionScale < 1.35) {
          resolutionScale = 1.25;
          setupGrid();
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
      className="fixed inset-0 pointer-events-none z-0 select-none"
    />
  );
}
