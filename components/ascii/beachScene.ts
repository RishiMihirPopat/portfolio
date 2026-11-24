import {
  AsciiScene,
  DEFAULT_ASCII_RAMP,
  SceneCellBuffers,
  SceneFrameContext,
  ScenePalette,
  SceneVeilStyle,
  SceneViewport,
  SceneWashTheme,
} from './types';

export interface BeachSceneParams {
  shoreAngle: number;
  tidePosition: number;
  swellSpeed: number;
  foamDensity: number;
  waveHeight: number;
  waveFreq: number;
  brightness: number;
  shallowsSpread: number;
}

const CONSTANT_SCENE: BeachSceneParams = {
  shoreAngle: 0.05,
  tidePosition: 0.64,
  swellSpeed: 0.88,
  foamDensity: 1.0,
  waveHeight: 1.05,
  waveFreq: 1.0,
  brightness: 1.0,
  shallowsSpread: 0.42,
};

const DARK_PALETTE: ScenePalette = [
  'hsla(204, 48%, 48%, 0.38)', // 0: deep ocean swells & caustics
  'hsla(194, 46%, 58%, 0.52)', // 1: mid-ocean swell face
  'hsla(184, 45%, 64%, 0.58)', // 2: turquoise shallows
  'hsla(192, 42%, 38%, 0.46)', // 3: wave trough shadow
  'hsla(178, 42%, 80%, 0.78)', // 4: lacy cellular foam wake & spray
  'hsla(46,  38%, 95%, 0.97)', // 5: bright ivory breaking surf & swash lip (#%@)
  'hsla(28,  40%, 44%, 0.58)', // 6: dark damp umber wet-sand band & tide line
  'hsla(38,  50%, 72%, 0.70)', // 7: warm golden-ochre dry sand grain
];

const LIGHT_PALETTE: ScenePalette = [
  'hsla(202, 46%, 34%, 0.44)', // 0: deep ocean caustics & flowing swell drift
  'hsla(194, 48%, 30%, 0.56)', // 1: mid-ocean swell
  'hsla(186, 48%, 28%, 0.54)', // 2: turquoise shallows ripples
  'hsla(192, 54%, 20%, 0.78)', // 3: deep wave-front shadow under breaking crest
  'hsla(180, 40%, 94%, 0.78)', // 4: lacy cellular foam wake & spray
  'hsla(48,  65%, 99%, 0.98)', // 5: crisp bright white breaking surf & swash lip (#%@)
  'hsla(28,  46%, 26%, 0.74)', // 6: dark damp umber wet-sand band & tide line
  'hsla(34,  48%, 36%, 0.62)', // 7: warm golden-ochre dry sand grain
];

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

class ProceduralBeachScene implements AsciiScene {
  readonly id = 'beach' as const;
  readonly label = 'beach';
  readonly ramp = DEFAULT_ASCII_RAMP;

  private gridCols = 0;
  private gridRows = 0;
  private wetSandBuffer = new Float32Array(0);
  private baseShoreCol = new Float32Array(0);
  private peakRunupCol = new Float32Array(0);
  private highTideCol = new Float32Array(0);
  private uColTable = new Float32Array(0);
  private bayArchTable = new Float32Array(0);

  private ensureGrid(cols: number, rows: number, isPhone: boolean): void {
    if (this.gridCols === cols && this.gridRows === rows) {
      return;
    }

    this.gridCols = cols;
    this.gridRows = rows;
    this.wetSandBuffer = new Float32Array(cols * rows);
    this.baseShoreCol = new Float32Array(cols);
    this.peakRunupCol = new Float32Array(cols);
    this.highTideCol = new Float32Array(cols);
    this.uColTable = new Float32Array(cols);
    this.bayArchTable = new Float32Array(cols);

    const initSwash = Math.max(8, Math.floor(rows * 0.12));
    const baseTide = isPhone ? 0.56 : 0.64;

    for (let c = 0; c < cols; c++) {
      const uCol = c / cols;
      this.uColTable[c] = uCol;
      const arch =
        Math.sin(uCol * Math.PI) * 0.045 +
        Math.sin(uCol * Math.PI * 3.2 + 0.4) * 0.024 +
        Math.cos(uCol * Math.PI * 6.4 - 0.7) * 0.01;
      this.bayArchTable[c] = arch;

      const initShore = Math.floor(rows * (baseTide + arch + (uCol - 0.5) * 0.05));
      const maxReach = Math.floor(initShore + initSwash);
      for (let r = initShore; r <= Math.min(rows - 1, maxReach); r++) {
        const frac = 1.0 - (r - initShore) / Math.max(1, maxReach - initShore);
        this.wetSandBuffer[r * cols + c] = 0.2 + 0.65 * frac;
      }
    }
  }

  onResize(viewport: SceneViewport): void {
    this.ensureGrid(viewport.cols, viewport.rows, viewport.isPhone);
  }

  getPalette(isLight: boolean): ScenePalette {
    return isLight ? LIGHT_PALETTE : DARK_PALETTE;
  }

  getWashTheme(isLight: boolean): SceneWashTheme {
    if (isLight) {
      return {
        troughColor: 'hsla(192, 54%, 22%, 0.82)',
        wakeColor: 'hsla(186, 48%, 34%, 0.76)',
        crestColor: 'hsla(48, 65%, 99%, 0.98)',
      };
    }
    return {
      troughColor: 'hsla(192, 42%, 38%, 0.48)',
      wakeColor: 'hsla(178, 42%, 80%, 0.80)',
      crestColor: 'hsla(46, 38%, 95%, 0.97)',
    };
  }

  getVeilStyle(isLight: boolean): SceneVeilStyle {
    if (isLight) {
      return {
        lightCenterRgba: 'hsla(42, 30%, 96%, 0.64)',
        lightMidRgba: 'hsla(42, 28%, 95%, 0.36)',
      };
    }
    return {};
  }

  renderBackdrop(ctx: CanvasRenderingContext2D, frame: SceneFrameContext): void {
    const P = CONSTANT_SCENE;
    const swashZoneRows = Math.max(8, Math.floor(frame.rows * 0.125));
    const effectiveTide = frame.isPhone ? P.tidePosition * 0.8 : P.tidePosition;
    const meanShoreY = Math.min(
      0.88,
      Math.max(
        0.32,
        ((frame.rows * effectiveTide + swashZoneRows * 0.4) * frame.cellH) /
          Math.max(1, frame.height)
      )
    );

    const bgGrad = ctx.createLinearGradient(
      frame.width * (0.5 + P.shoreAngle * 0.8),
      0,
      frame.width * (0.5 - P.shoreAngle * 0.8),
      frame.height
    );

    if (frame.isLight) {
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
    ctx.fillRect(0, 0, frame.width, frame.height);
  }

  renderCells(frame: SceneFrameContext, buffers: SceneCellBuffers): void {
    const { cols, rows, t, isPhone, washActive, washProgress, washCrestRows, pointerX, pointerY } =
      frame;
    this.ensureGrid(cols, rows, isPhone);

    const P = CONSTANT_SCENE;
    const rowScale = rows / 64;
    const invRowScale = 1 / rowScale;
    const invColScale = 180 / cols;

    const swashZoneRows = Math.max(8, Math.floor(rows * 0.125));
    const swashScale = swashZoneRows * Math.min(1.35, P.waveHeight);
    const effectiveTide = (isPhone ? P.tidePosition * 0.8 : P.tidePosition) + pointerY * 0.018;
    const pxShift = pointerX * 0.025;

    for (let c = 0; c < cols; c++) {
      const uCol = this.uColTable[c];
      const shoreRatio =
        effectiveTide +
        this.bayArchTable[c] +
        (uCol - 0.5) * P.shoreAngle +
        (valueNoise2D(uCol * 5.0 + t * 0.04 + pxShift, t * 0.08) - 0.5) * 0.025;

      const bRow = Math.max(
        Math.floor(rows * 0.26),
        Math.min(rows - Math.floor(13 * rowScale), rows * shoreRatio)
      );
      this.baseShoreCol[c] = bRow;

      const tongue1 =
        0.5 + 0.5 * Math.sin(t * (1.15 * P.waveFreq) - (uCol + pxShift * 0.4) * Math.PI * 2.6);
      const tongue2 =
        0.5 +
        0.5 * Math.sin(t * (0.85 * P.waveFreq) + (uCol + pxShift * 0.4) * Math.PI * 3.8 + 1.4);
      const combinedSurge = 0.65 * Math.pow(tongue1, 1.35) + 0.35 * Math.pow(tongue2, 1.5);

      this.peakRunupCol[c] = bRow + combinedSurge * swashScale;
      this.highTideCol[c] = bRow + swashScale * 0.98;
    }

    const tInt4 = Math.floor(t * 4);
    const tInt2 = Math.floor(t * 2);
    const edgeFade = washActive
      ? smoothstep(0.0, 0.08, washProgress) * (1.0 - smoothstep(0.88, 1.0, washProgress))
      : 0;

    for (let r = 0; r < rows; r++) {
      const rNorm = r * invRowScale;
      const rowWobble =
        ((valueNoise2D(rNorm * 0.42 + t * 0.24, t * 0.18) - 0.5) * 2.2 +
          Math.sin(rNorm * 0.9 + t * 0.6) * 0.65) *
        rowScale;
      const rowBase = r * cols;

      for (let c = 0; c < cols; c++) {
        const cellIdx = rowBase + c;
        const cNorm = c * invColScale;
        const shoreRow = this.baseShoreCol[c];

        // Wet sand interaction when transition wave sweeps across the shore
        if (washActive && washCrestRows && r >= shoreRow) {
          const dist = (r - washCrestRows[c]) * invRowScale;
          if (dist >= -3.5 && dist <= 1.5) {
            this.wetSandBuffer[cellIdx] = Math.max(
              this.wetSandBuffer[cellIdx],
              0.85 * edgeFade
            );
          }
        }

        let luma = 0.0;
        let tierIdx = 0;

        if (r < shoreRow) {
          const uWater = Math.max(0, Math.min(1, r / Math.max(1, shoreRow)));
          const uCol = this.uColTable[c];

          const shoalCoord = Math.pow(uWater, 0.78) * 28.0 * P.waveFreq;
          const refractNoise =
            fbm(uCol * 2.8 - t * 0.06 + pxShift, uWater * 2.4 - t * 0.14, 2) - 0.5;
          const lateralBend =
            Math.sin((uCol + pxShift * 0.3) * Math.PI * 2.0 + uWater * 2.2) * 1.1 +
            Math.cos((uCol + pxShift * 0.3) * Math.PI * 4.5 - uWater * 1.6 + t * 0.3) * 0.55 +
            refractNoise * 3.4;

          const wavePhase =
            shoalCoord - t * (2.15 * P.waveFreq * P.swellSpeed) + lateralBend;

          const s1 = Math.sin(wavePhase);
          const s2 = 0.38 * Math.sin(wavePhase * 2.0 - 0.85);
          const waveHeightNorm = (s1 + s2) / 1.38;

          const baseCrestEnvelope =
            0.48 +
            0.52 *
              valueNoise2D(
                cNorm * 0.038 + uWater * 2.4 + t * 0.12 + pxShift * 2.0,
                uWater * 4.2 - t * 0.18
              );
          const crestEnvelope = washActive ? 0.0 : baseCrestEnvelope;

          const wrapped =
            (((wavePhase - Math.PI * 0.42) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) -
            Math.PI;

          const shoalIntensity = smoothstep(0.04, 0.82, uWater);
          const crestHalfWidth =
            (0.24 + 0.44 * shoalIntensity) *
            Math.min(1.35, P.waveHeight) *
            crestEnvelope;

          if (Math.abs(wrapped) < crestHalfWidth && uWater > 0.05 && crestEnvelope > 0.4) {
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
            crestEnvelope > 0.4
          ) {
            const wakeSpan = crestHalfWidth * (1.6 + 2.2 * shoalIntensity);
            const wakeDecay = 1.0 - (-wrapped - crestHalfWidth) / Math.max(0.01, wakeSpan);
            const cellWeb = valueNoise2D(cNorm * 0.22 + t * 0.2, rNorm * 0.32 - t * 0.3);
            const sprayHash = fastHash(c + tInt4, r);

            if (
              cellWeb > 0.56 - wakeDecay * 0.28 &&
              sprayHash < wakeDecay * 0.78 * P.foamDensity
            ) {
              luma = (0.32 + 0.46 * wakeDecay * cellWeb) * P.brightness;
              tierIdx = 4;
            } else {
              luma = (0.2 + 0.16 * shoalIntensity) * P.brightness;
              tierIdx = uWater > 0.45 ? 2 : 1;
            }
          } else if (
            wrapped > crestHalfWidth &&
            wrapped < crestHalfWidth * 2.2 &&
            uWater > 0.12 &&
            crestEnvelope > 0.42
          ) {
            const shadowFactor = 1.0 - (wrapped - crestHalfWidth) / (crestHalfWidth * 1.2);
            luma = (0.3 + 0.36 * shadowFactor * shoalIntensity) * P.brightness;
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
              luma = (0.2 + (upperFlow - 0.52) * 0.75) * P.brightness;
              tierIdx = upperFlow > 0.66 ? 1 : 0;
            } else if (caustic > 0.64) {
              luma = (0.18 + (caustic - 0.64) * 0.55) * P.brightness;
              tierIdx = uWater > 0.5 ? 2 : 0;
            } else {
              const glint = fastHash(c + tInt2, r);
              luma = glint > 0.87 ? 0.2 : 0.0;
              tierIdx = uWater > 0.5 ? 2 : 0;
            }
          }
        } else {
          const runupRow = this.peakRunupCol[c] + rowWobble;
          const distFromRunup = (r - runupRow) * invRowScale;
          const highTideRow = this.highTideCol[c] + rowWobble * 0.85;

          if (distFromRunup <= 0) {
            this.wetSandBuffer[cellIdx] = 1.0;

            if (distFromRunup > -1.8) {
              const lipCore = 1.0 - Math.abs(distFromRunup) / 1.8;
              luma = washActive ? 0.0 : Math.min(0.99, 0.78 + 0.21 * lipCore);
              tierIdx = washActive ? 0 : 5;
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
            const prevWet = this.wetSandBuffer[cellIdx];
            const nextWet = prevWet * 0.986;
            this.wetSandBuffer[cellIdx] = nextWet;

            const distToHighTide = (r - highTideRow) * invRowScale;

            if (distToHighTide <= 1.8 || nextWet > 0.12) {
              const isDarkWetEdge =
                Math.abs(distToHighTide) < 1.7 || (nextWet > 0.14 && nextWet < 0.45);
              if (isDarkWetEdge) {
                luma = 0.54 + 0.18 * valueNoise2D(cNorm * 0.15, rNorm * 0.3);
              } else {
                luma = 0.3 + 0.2 * nextWet;
              }
              tierIdx = 6;
            } else {
              const h = fastHash(c, r);
              const windRipple =
                Math.sin(
                  (r - highTideRow) * invRowScale * 1.35 + Math.sin(cNorm * 0.06) * 1.5
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

        buffers.lumas[cellIdx] = luma;
        buffers.tiers[cellIdx] = tierIdx;
      }
    }
  }
}

export const beachScene: AsciiScene = new ProceduralBeachScene();
