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

// ============================================================================
// Color Palettes (12 tiers: 0..11)
// ============================================================================

const DARK_PALETTE: ScenePalette = [
  'hsla(222, 42%, 64%, 0.36)', // 0: midnight sky stars & high mist
  'hsla(216, 34%, 58%, 0.44)', // 1: drifting night clouds & atmospheric haze
  'hsla(46,  60%, 88%, 0.86)', // 2: crescent moon & celestial rim
  'hsla(222, 32%, 44%, 0.48)', // 3: far skyline silhouettes & distant towers
  'hsla(214, 28%, 54%, 0.60)', // 4: midground skyscraper facades & mullions
  'hsla(208, 30%, 68%, 0.74)', // 5: foreground skyscraper edges, spires & bridge steel
  'hsla(38,  88%, 72%, 0.92)', // 6: warm amber lit windows & bridge lamps
  'hsla(192, 70%, 76%, 0.84)', // 7: cool cyan-white office windows & deck lights
  'hsla(6,   88%, 64%, 0.96)', // 8: blinking rooftop aviation beacons & tail-lights
  'hsla(48,  94%, 90%, 0.97)', // 9: elevated train & traffic headlights
  'hsla(212, 44%, 46%, 0.44)', // 10: harbor water ripples & building shadows
  'hsla(36,  76%, 68%, 0.66)', // 11: shimmering golden water reflections
];

const LIGHT_PALETTE: ScenePalette = [
  'hsla(208, 40%, 40%, 0.34)', // 0: crisp upper sky accents
  'hsla(40,  40%, 98%, 0.82)', // 1: bright drifting cumulus clouds
  'hsla(40,  86%, 56%, 0.88)', // 2: golden-hour sun & cloud rim highlights
  'hsla(212, 28%, 48%, 0.44)', // 3: far skyline haze silhouette
  'hsla(214, 26%, 32%, 0.62)', // 4: midground architectural shading
  'hsla(216, 34%, 19%, 0.80)', // 5: foreground crisp ink-slate edges, spires & bridge
  'hsla(34,  78%, 44%, 0.76)', // 6: sunlit golden-amber glass highlights & rim light
  'hsla(200, 56%, 38%, 0.64)', // 7: cool sky-reflecting glass panes
  'hsla(8,   74%, 46%, 0.84)', // 8: vermilion aviation beacons & bridge signals
  'hsla(44,  82%, 50%, 0.88)', // 9: sun glints & train metallic highlights
  'hsla(202, 38%, 36%, 0.48)', // 10: harbor river ripples & reflections
  'hsla(36,  64%, 42%, 0.58)', // 11: warm golden water reflections
];

// ============================================================================
// Fast Deterministic Noise & Math Helpers
// ============================================================================

const PERM = new Uint8Array(512);
const VALS = new Float32Array(256);

(() => {
  let seed = 428197351;
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
    const nx = (px * 0.8 - py * 0.6) * 2.01 + 2.3;
    const ny = (px * 0.6 + py * 0.8) * 2.01 + 7.9;
    px = nx;
    py = ny;
    amp *= 0.5;
  }
  return value / norm;
}

function fastHash(a: number, b: number): number {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Pre-resolved ASCII char codes for fast inner-loop assignment
const CH_SPACE = 32;
const CH_PIPE = 124; // |
const CH_UNDERSCORE = 95; // _
const CH_DASH = 45; // -
const CH_EQUALS = 61; // =
const CH_SLASH = 47; // /
const CH_BSLASH = 92; // \
const CH_CARET = 94; // ^
const CH_COLON = 58; // :
const CH_DOT = 46; // .
const CH_COMMA = 44; // ,
const CH_APOS = 39; // '
const CH_PLUS = 43; // +
const CH_STAR = 42; // *
const CH_HASH = 35; // #
const CH_AT = 64; // @
const CH_TILDE = 126; // ~
const CH_LBRACK = 91; // [
const CH_RBRACK = 93; // ]
const CH_LPAREN = 40; // (
const CH_RPAREN = 41; // )
const CH_GT = 62; // >
const CH_LT = 60; // <

// ============================================================================
// Skyline Architecture Types & Blueprints
// ============================================================================

type RoofType = 'flat' | 'stepped' | 'crown' | 'peaked' | 'slantLeft' | 'slantRight';

interface BuildingDef {
  id: number;
  layer: 0 | 1 | 2;
  startCol: number; // padded column index [0..paddedCols-1]
  endCol: number;
  width: number;
  wallTopRow: number;
  roofType: RoofType;
  spireCol: number; // padded col or -1
  spireTopRow: number; // row or -1
  hasBeacon: boolean;
  beaconCol: number;
  beaconRow: number;
  beaconPhase: number;
  hasWaterTower: boolean;
  windowStyle: 0 | 1 | 2 | 3;
  seed: number;
}

interface HeroBlueprint {
  uCenter: number;
  widthU: number;
  heightFrac: number;
  roofType: RoofType;
  spireFrac: number;
  hasBeacon: boolean;
  beaconPhase: number;
  hasWaterTower: boolean;
  windowStyle: 0 | 1 | 2 | 3;
}

const FORE_BLUEPRINTS: readonly HeroBlueprint[] = [
  {
    uCenter: 0.075,
    widthU: 0.062,
    heightFrac: 0.48,
    roofType: 'stepped',
    spireFrac: 0.0,
    hasBeacon: false,
    beaconPhase: 0.4,
    hasWaterTower: true,
    windowStyle: 3,
  },
  {
    uCenter: 0.165,
    widthU: 0.064,
    heightFrac: 0.62,
    roofType: 'slantRight',
    spireFrac: 0.09,
    hasBeacon: true,
    beaconPhase: 0.9,
    hasWaterTower: false,
    windowStyle: 1,
  },
  {
    uCenter: 0.25,
    widthU: 0.052,
    heightFrac: 0.35,
    roofType: 'flat',
    spireFrac: 0.0,
    hasBeacon: false,
    beaconPhase: 1.5,
    hasWaterTower: true,
    windowStyle: 0,
  },
  {
    // Slim mid-bay needle spire peeking above the suspension bridge
    uCenter: 0.495,
    widthU: 0.036,
    heightFrac: 0.46,
    roofType: 'peaked',
    spireFrac: 0.13,
    hasBeacon: true,
    beaconPhase: 2.1,
    hasWaterTower: false,
    windowStyle: 2,
  },
  {
    uCenter: 0.645,
    widthU: 0.062,
    heightFrac: 0.66,
    roofType: 'flat',
    spireFrac: 0.0,
    hasBeacon: true,
    beaconPhase: 1.2,
    hasWaterTower: false,
    windowStyle: 1,
  },
  {
    // Centerpiece Art-Deco Landmark Spire
    uCenter: 0.745,
    widthU: 0.078,
    heightFrac: 0.77,
    roofType: 'crown',
    spireFrac: 0.17,
    hasBeacon: true,
    beaconPhase: 0.35,
    hasWaterTower: false,
    windowStyle: 0,
  },
  {
    uCenter: 0.845,
    widthU: 0.064,
    heightFrac: 0.59,
    roofType: 'slantLeft',
    spireFrac: 0.0,
    hasBeacon: true,
    beaconPhase: 2.75,
    hasWaterTower: false,
    windowStyle: 2,
  },
  {
    uCenter: 0.935,
    widthU: 0.06,
    heightFrac: 0.43,
    roofType: 'stepped',
    spireFrac: 0.0,
    hasBeacon: false,
    beaconPhase: 0.0,
    hasWaterTower: true,
    windowStyle: 3,
  },
];

const PAD_COLS = 14;

interface CellSample {
  charCode: number;
  luma: number;
  tier: number;
}

class ProceduralCityScene implements AsciiScene {
  readonly id = 'city' as const;
  readonly label = 'city';
  readonly ramp = DEFAULT_ASCII_RAMP;

  private layoutCols = 0;
  private layoutRows = 0;
  private layoutIsPhone = false;
  private paddedCols = 0;
  private horizonRow = 0;
  private bridgeDeckRow = 0;
  private bridgeTowerLeftCol = 0;
  private bridgeTowerRightCol = 0;
  private bridgeTowerTopRow = 0;

  private buildings: BuildingDef[] = [];
  private layerColMap: [Int16Array, Int16Array, Int16Array] = [
    new Int16Array(0),
    new Int16Array(0),
    new Int16Array(0),
  ];

  // Scratch buffers for the upper half (rows 0..horizonRow) so harbor water can mirror them cleanly
  private skyChars = new Uint16Array(0);
  private skyLumas = new Float32Array(0);
  private skyTiers = new Uint8Array(0);

  private readonly tmpSample: CellSample = { charCode: 0, luma: 0, tier: 0 };

  getPalette(isLight: boolean): ScenePalette {
    return isLight ? LIGHT_PALETTE : DARK_PALETTE;
  }

  getWashTheme(isLight: boolean): SceneWashTheme {
    if (isLight) {
      return {
        troughColor: 'hsla(206, 42%, 34%, 0.66)',
        wakeColor: 'hsla(38, 62%, 88%, 0.80)',
        crestColor: 'hsla(42, 80%, 97%, 0.96)',
        crestChars: '*#%@',
        wakeChars: '.:;-~=+*',
      };
    }
    return {
      troughColor: 'hsla(216, 48%, 42%, 0.56)',
      wakeColor: 'hsla(198, 52%, 72%, 0.78)',
      crestColor: 'hsla(42, 85%, 90%, 0.96)',
      crestChars: '*#%@',
      wakeChars: '.:;-~=+*',
    };
  }

  getVeilStyle(): SceneVeilStyle {
    return {
      lightCenterRgba: 'hsla(42, 28%, 96%, 0.66)',
      lightMidRgba: 'hsla(204, 24%, 93%, 0.34)',
      darkCenterRgba: 'hsla(220, 34%, 8%, 0.50)',
      darkMidRgba: 'hsla(220, 28%, 9%, 0.22)',
    };
  }

  onResize(viewport: SceneViewport): void {
    this.ensureLayout(viewport.cols, viewport.rows, viewport.isPhone);
  }

  private ensureLayout(cols: number, rows: number, isPhone: boolean): void {
    const skyCellCount = (Math.round(rows * (isPhone ? 0.67 : 0.71)) + 2) * cols;
    if (
      this.layoutCols === cols &&
      this.layoutRows === rows &&
      this.layoutIsPhone === isPhone &&
      this.skyChars.length >= skyCellCount
    ) {
      return;
    }

    this.layoutCols = cols;
    this.layoutRows = rows;
    this.layoutIsPhone = isPhone;
    this.paddedCols = cols + PAD_COLS * 2;
    this.horizonRow = Math.max(20, Math.round(rows * (isPhone ? 0.67 : 0.71)));
    this.bridgeDeckRow = Math.max(
      14,
      this.horizonRow - Math.max(2, Math.round(rows * 0.036))
    );
    this.bridgeTowerLeftCol = Math.round(cols * 0.295);
    this.bridgeTowerRightCol = Math.round(cols * 0.615);
    this.bridgeTowerTopRow = Math.max(
      6,
      this.bridgeDeckRow - Math.max(6, Math.round(rows * (isPhone ? 0.12 : 0.145)))
    );

    const neededSky = (this.horizonRow + 2) * cols;
    if (this.skyChars.length < neededSky) {
      this.skyChars = new Uint16Array(neededSky);
      this.skyLumas = new Float32Array(neededSky);
      this.skyTiers = new Uint8Array(neededSky);
    }

    for (let l = 0; l < 3; l++) {
      this.layerColMap[l] = new Int16Array(this.paddedCols);
      this.layerColMap[l].fill(-1);
    }
    this.buildings = [];

    // ------------------------------------------------------------------------
    // Layer 0: Far Skyline Silhouettes (dense distant towers across the width)
    // ------------------------------------------------------------------------
    let cursor = 1;
    let idCounter = 0;
    const farMinW = isPhone ? 4 : 7;
    const farMaxW = isPhone ? 8 : 16;
    while (cursor < this.paddedCols - 4) {
      const h1 = fastHash(idCounter, 101);
      const h2 = fastHash(idCounter, 202);
      const h3 = fastHash(idCounter, 303);
      const w = Math.round(farMinW + h1 * (farMaxW - farMinW));
      const endCol = Math.min(this.paddedCols - 2, cursor + w - 1);
      const actualW = endCol - cursor + 1;
      if (actualW < 4) break;

      const uMid = (cursor + actualW * 0.5 - PAD_COLS) / Math.max(1, cols);
      // Dip slightly over the center bay so sky & bridge cables breathe
      const bayDip = 1.0 - 0.24 * Math.exp(-Math.pow((uMid - 0.46) / 0.2, 2));
      const heightFrac = (0.34 + h2 * 0.36) * bayDip;
      const wallTopRow = Math.max(
        4,
        this.horizonRow - Math.max(8, Math.round(this.horizonRow * heightFrac))
      );
      const roofRoll = h3;
      const roofType: RoofType =
        roofRoll > 0.72 ? 'stepped' : roofRoll > 0.45 ? 'peaked' : 'flat';

      const bIdx = this.buildings.length;
      this.buildings.push({
        id: idCounter++,
        layer: 0,
        startCol: cursor,
        endCol,
        width: actualW,
        wallTopRow,
        roofType,
        spireCol: roofType === 'peaked' && actualW >= 5 ? cursor + Math.floor(actualW / 2) : -1,
        spireTopRow:
          roofType === 'peaked' && actualW >= 5
            ? Math.max(2, wallTopRow - Math.max(2, Math.round(rows * 0.04)))
            : -1,
        hasBeacon: false,
        beaconCol: -1,
        beaconRow: -1,
        beaconPhase: h1 * 6.28,
        hasWaterTower: false,
        windowStyle: (idCounter % 4) as 0 | 1 | 2 | 3,
        seed: Math.floor(h1 * 10000),
      });
      for (let c = cursor; c <= endCol; c++) {
        this.layerColMap[0][c] = bIdx;
      }
      cursor = endCol + 1 + (h2 > 0.65 ? (isPhone ? 1 : 2) : 0);
    }

    // ------------------------------------------------------------------------
    // Layer 1: Midground Skyline (varied urban towers behind foreground heroes)
    // ------------------------------------------------------------------------
    cursor = 2;
    const midMinW = isPhone ? 5 : 8;
    const midMaxW = isPhone ? 10 : 18;
    while (cursor < this.paddedCols - 5) {
      const h1 = fastHash(idCounter, 401);
      const h2 = fastHash(idCounter, 502);
      const h3 = fastHash(idCounter, 603);
      const w = Math.round(midMinW + h1 * (midMaxW - midMinW));
      const endCol = Math.min(this.paddedCols - 2, cursor + w - 1);
      const actualW = endCol - cursor + 1;
      if (actualW < 4) break;

      const uMid = (cursor + actualW * 0.5 - PAD_COLS) / Math.max(1, cols);
      const bayDip = 1.0 - 0.34 * Math.exp(-Math.pow((uMid - 0.45) / 0.19, 2));
      const heightFrac = (0.28 + h2 * 0.34) * bayDip;
      const wallTopRow = Math.max(
        6,
        this.horizonRow - Math.max(7, Math.round(this.horizonRow * heightFrac))
      );

      const roofTypes: RoofType[] = ['flat', 'stepped', 'slantLeft', 'slantRight', 'peaked'];
      const roofType = roofTypes[Math.floor(h3 * roofTypes.length) % roofTypes.length];
      const hasSpire = roofType === 'peaked' && h2 > 0.55 && actualW >= 5;
      const spireCol = hasSpire ? cursor + Math.floor(actualW / 2) : -1;
      const spireTopRow = hasSpire
        ? Math.max(3, wallTopRow - Math.max(2, Math.round(rows * 0.045)))
        : -1;

      const bIdx = this.buildings.length;
      this.buildings.push({
        id: idCounter++,
        layer: 1,
        startCol: cursor,
        endCol,
        width: actualW,
        wallTopRow,
        roofType,
        spireCol,
        spireTopRow,
        hasBeacon: hasSpire && h1 > 0.5,
        beaconCol: spireCol,
        beaconRow: spireTopRow,
        beaconPhase: h1 * 6.28,
        hasWaterTower: roofType === 'flat' && actualW >= 7 && h2 > 0.62,
        windowStyle: (Math.floor(h3 * 4) % 4) as 0 | 1 | 2 | 3,
        seed: Math.floor(h2 * 10000),
      });
      for (let c = cursor; c <= endCol; c++) {
        this.layerColMap[1][c] = bIdx;
      }
      const gap = h3 > 0.45 ? (isPhone ? 1 : 2 + Math.floor(h1 * 3)) : 1;
      cursor = endCol + 1 + gap;
    }

    // ------------------------------------------------------------------------
    // Layer 2: Foreground Curated Hero Skyscrapers & Landmark Spires
    // ------------------------------------------------------------------------
    const foreMap = this.layerColMap[2];
    for (let i = 0; i < FORE_BLUEPRINTS.length; i++) {
      const bp = FORE_BLUEPRINTS[i];
      const centerCol = PAD_COLS + Math.round(bp.uCenter * cols);
      let w = clamp(Math.round(bp.widthU * cols), isPhone ? 5 : 8, isPhone ? 10 : 23);
      // Force odd width on symmetrical crown/peaked towers so spires sit dead-center
      if ((bp.roofType === 'crown' || bp.roofType === 'peaked') && w % 2 === 0) {
        w += 1;
      }
      const half = Math.floor(w / 2);
      const startCol = clamp(centerCol - half, 1, this.paddedCols - w - 1);
      const endCol = startCol + w - 1;

      // Avoid stomping an already placed foreground tower
      let overlaps = false;
      for (let c = startCol; c <= endCol; c++) {
        if (foreMap[c] !== -1) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      const wallTopRow = Math.max(
        6,
        this.horizonRow - Math.max(10, Math.round(this.horizonRow * bp.heightFrac))
      );
      const hasSpire = bp.spireFrac > 0;
      const spireCol = hasSpire ? startCol + Math.floor(w / 2) : -1;
      const spireTopRow = hasSpire
        ? Math.max(2, wallTopRow - Math.max(3, Math.round(this.horizonRow * bp.spireFrac)))
        : -1;

      let beaconCol = -1;
      let beaconRow = -1;
      if (bp.hasBeacon) {
        if (hasSpire) {
          beaconCol = spireCol;
          beaconRow = spireTopRow;
        } else {
          beaconCol = bp.roofType === 'slantLeft' ? endCol - 1 : startCol + 1;
          beaconRow = wallTopRow - 1;
        }
      }

      const bIdx = this.buildings.length;
      this.buildings.push({
        id: idCounter++,
        layer: 2,
        startCol,
        endCol,
        width: w,
        wallTopRow,
        roofType: bp.roofType,
        spireCol,
        spireTopRow,
        hasBeacon: bp.hasBeacon,
        beaconCol,
        beaconRow,
        beaconPhase: bp.beaconPhase,
        hasWaterTower: bp.hasWaterTower && w >= 6,
        windowStyle: bp.windowStyle,
        seed: 7000 + i * 313,
      });
      for (let c = startCol; c <= endCol; c++) {
        foreMap[c] = bIdx;
      }
    }
  }

  /**
   * Computes row-specific column bounds for stepped, crowned, peaked, and slanted roofs.
   */
  private getSpanAtRow(
    b: BuildingDef,
    r: number
  ): { left: number; right: number; prevLeft: number; prevRight: number } {
    const H = Math.max(1, this.horizonRow - b.wallTopRow);
    const hFrac = (r - b.wallTopRow) / H;

    const computeBounds = (hf: number): [number, number] => {
      if (hf < 0) return [1, -1];
      const W = b.width;
      if (b.roofType === 'flat') return [b.startCol, b.endCol];

      if (b.roofType === 'stepped' && W >= 6) {
        const inset = hf < 0.24 ? Math.min(Math.floor((W - 3) / 2), Math.max(1, Math.floor(W * 0.16))) : 0;
        return [b.startCol + inset, b.endCol - inset];
      }

      if (b.roofType === 'crown' && W >= 7) {
        let inset = 0;
        if (hf < 0.13) {
          inset = Math.min(Math.floor((W - 3) / 2), Math.max(2, Math.floor(W * 0.28)));
        } else if (hf < 0.34) {
          inset = Math.min(Math.floor((W - 3) / 2), Math.max(1, Math.floor(W * 0.14)));
        }
        return [b.startCol + inset, b.endCol - inset];
      }

      if (b.roofType === 'peaked' && W >= 5 && hf < 0.16) {
        const maxInset = Math.floor((W - 3) / 2);
        const inset = Math.round((1 - hf / 0.16) * maxInset);
        return [b.startCol + inset, b.endCol - inset];
      }

      if (b.roofType === 'slantRight' && W >= 5 && hf < 0.15) {
        const slopeCols = Math.max(1, Math.floor(W * 0.72));
        const trim = Math.round((1 - hf / 0.15) * slopeCols);
        return [b.startCol, Math.max(b.startCol + 2, b.endCol - trim)];
      }

      if (b.roofType === 'slantLeft' && W >= 5 && hf < 0.15) {
        const slopeCols = Math.max(1, Math.floor(W * 0.72));
        const trim = Math.round((1 - hf / 0.15) * slopeCols);
        return [Math.min(b.endCol - 2, b.startCol + trim), b.endCol];
      }

      return [b.startCol, b.endCol];
    };

    const [left, right] = computeBounds(hFrac);
    const [prevLeft, prevRight] = computeBounds((r - 1 - b.wallTopRow) / H);
    return { left, right, prevLeft, prevRight };
  }

  // ==========================================================================
  // Backdrop Gradient & Urban Horizon Glow
  // ==========================================================================

  renderBackdrop(ctx: CanvasRenderingContext2D, frame: SceneFrameContext): void {
    const { width, height, rows, isPhone, isLight } = frame;
    const horizonFrac = (Math.round(rows * (isPhone ? 0.67 : 0.71)) / Math.max(1, rows));

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    if (isLight) {
      grad.addColorStop(0.0, 'hsla(204, 48%, 74%, 0.88)');
      grad.addColorStop(Math.max(0.15, horizonFrac * 0.45), 'hsla(198, 42%, 82%, 0.88)');
      grad.addColorStop(Math.max(0.25, horizonFrac - 0.08), 'hsla(38, 48%, 83%, 0.88)');
      grad.addColorStop(horizonFrac, 'hsla(34, 52%, 80%, 0.90)');
      grad.addColorStop(Math.min(0.98, horizonFrac + 0.06), 'hsla(202, 34%, 72%, 0.88)');
      grad.addColorStop(1.0, 'hsla(208, 40%, 62%, 0.92)');
    } else {
      grad.addColorStop(0.0, 'hsla(224, 52%, 7%, 0.54)');
      grad.addColorStop(Math.max(0.18, horizonFrac * 0.52), 'hsla(220, 44%, 11%, 0.46)');
      grad.addColorStop(Math.max(0.28, horizonFrac - 0.04), 'hsla(26, 36%, 13%, 0.36)');
      grad.addColorStop(horizonFrac, 'hsla(216, 40%, 11%, 0.42)');
      grad.addColorStop(1.0, 'hsla(220, 52%, 7%, 0.56)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle warm radial glow behind the Financial District / Moon-Sun quadrant
    const glowX = width * 0.78 + frame.pointerX * 14;
    const glowY = height * (horizonFrac * 0.72) + frame.pointerY * 8;
    const glowR = Math.max(width, height) * 0.36;
    const glow = ctx.createRadialGradient(glowX, glowY, glowR * 0.05, glowX, glowY, glowR);
    if (isLight) {
      glow.addColorStop(0.0, 'hsla(42, 78%, 84%, 0.34)');
      glow.addColorStop(1.0, 'hsla(42, 78%, 84%, 0.0)');
    } else {
      glow.addColorStop(0.0, 'hsla(32, 70%, 24%, 0.22)');
      glow.addColorStop(1.0, 'hsla(32, 70%, 24%, 0.0)');
    }
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // ==========================================================================
  // Per-Cell Procedural Cityscape Renderer
  // ==========================================================================

  renderCells(frame: SceneFrameContext, buffers: SceneCellBuffers): void {
    const { cols, rows, isPhone, isLight, t, pointerX, pointerY } = frame;
    this.ensureLayout(cols, rows, isPhone);

    const horizonRow = this.horizonRow;
    const deckRow = this.bridgeDeckRow;
    const shiftFar = Math.round(clamp(pointerX * (isPhone ? 1.2 : 2.5), -4, 4));
    const shiftMid = Math.round(clamp(pointerX * (isPhone ? 2.4 : 5.2), -7, 7));
    const shiftFore = Math.round(clamp(pointerX * (isPhone ? 3.8 : 8.5), -11, 11));
    const shiftSkyY = Math.round(clamp(pointerY * (isPhone ? 1.0 : 2.0), -3, 3));

    // Animated elevated train & street traffic positions
    // At t = 12.5 (reducedMotion freeze frame), train sits cleanly over the center bay (u ~ 0.41)
    const trainSpan = 1.32;
    const trainHeadU = ((t * 0.07 + 0.985) % trainSpan) - 0.16;
    const trainHeadCol = Math.round(trainHeadU * cols);
    const trainLen = isPhone ? 8 : 16;

    const traffic1U = 1.12 - ((t * 0.11 + 0.35) % 1.28);
    const traffic1Col = Math.round(traffic1U * cols);
    const traffic2U = ((t * 0.095 + 0.65) % 1.28) - 0.14;
    const traffic2Col = Math.round(traffic2U * cols);

    // Moon / Sun anchor in upper-right open sky
    const celestialU = 0.87;
    const celestialCol = Math.round(celestialU * cols) - Math.round(shiftFar * 0.6);
    const celestialRow = Math.max(3, Math.round(horizonRow * 0.18)) - shiftSkyY;

    const cellOut = this.tmpSample;

    // ------------------------------------------------------------------------
    // Pass 1: Upper World (rows 0 .. horizonRow)
    // ------------------------------------------------------------------------
    for (let r = 0; r <= horizonRow && r < rows; r++) {
      const rowOffset = r * cols;

      for (let c = 0; c < cols; c++) {
        cellOut.charCode = 0;
        cellOut.luma = 0;
        cellOut.tier = 0;

        let covered = false;

        // 1) Seawall Promenade & Harbor Quay (bottom row of upper world)
        if (r === horizonRow) {
          this.samplePromenadeCell(c, cols, isPhone, isLight, t, traffic1Col, traffic2Col, cellOut);
          covered = cellOut.luma > 0;
        }

        // 2) Foreground Hero Skyscrapers (Layer 2)
        if (!covered) {
          const pCol = c + PAD_COLS - shiftFore;
          if (pCol >= 0 && pCol < this.paddedCols) {
            const bIdx = this.layerColMap[2][pCol];
            if (bIdx >= 0) {
              covered = this.sampleBuildingCell(
                this.buildings[bIdx],
                r,
                pCol,
                isLight,
                isPhone,
                t,
                cellOut
              );
            }
          }
        }

        // 3) Harbor Suspension Bridge & Elevated Rail (between Fore and Mid/Far!)
        if (!covered) {
          covered = this.sampleBridgeCell(
            r,
            c,
            cols,
            deckRow,
            isPhone,
            isLight,
            t,
            trainHeadCol,
            trainLen,
            cellOut
          );
        }

        // 4) Midground Skyline (Layer 1)
        if (!covered) {
          const pCol = c + PAD_COLS - shiftMid;
          if (pCol >= 0 && pCol < this.paddedCols) {
            const bIdx = this.layerColMap[1][pCol];
            if (bIdx >= 0) {
              covered = this.sampleBuildingCell(
                this.buildings[bIdx],
                r,
                pCol,
                isLight,
                isPhone,
                t,
                cellOut
              );
            }
          }
        }

        // 5) Far Skyline Silhouettes (Layer 0)
        if (!covered) {
          const pCol = c + PAD_COLS - shiftFar;
          if (pCol >= 0 && pCol < this.paddedCols) {
            const bIdx = this.layerColMap[0][pCol];
            if (bIdx >= 0) {
              covered = this.sampleBuildingCell(
                this.buildings[bIdx],
                r,
                pCol,
                isLight,
                isPhone,
                t,
                cellOut
              );
            }
          }
        }

        // 6) Sky: Stars, Moon/Sun, and Drifting Clouds
        if (!covered) {
          this.sampleSkyCell(
            r,
            c,
            cols,
            horizonRow,
            celestialCol,
            celestialRow,
            shiftSkyY,
            isPhone,
            isLight,
            t,
            cellOut
          );
        }

        const idx = rowOffset + c;
        buffers.lumas[idx] = cellOut.luma;
        buffers.tiers[idx] = cellOut.tier;
        buffers.charCodes[idx] = cellOut.charCode;

        this.skyLumas[idx] = cellOut.luma;
        this.skyTiers[idx] = cellOut.tier;
        this.skyChars[idx] = cellOut.charCode;
      }
    }

    // ------------------------------------------------------------------------
    // Pass 2: Harbor Water & Wet-Pavement Reflections (rows horizonRow+1 .. rows-1)
    // ------------------------------------------------------------------------
    const waterRows = Math.max(1, rows - 1 - horizonRow);
    for (let r = horizonRow + 1; r < rows; r++) {
      const rowOffset = r * cols;
      const distRows = r - horizonRow;
      const depth = distRows / waterRows; // 0 near quay -> 1 at bottom edge
      const mirrorR = horizonRow - 1 - Math.floor(distRows * 1.18);

      for (let c = 0; c < cols; c++) {
        const idx = rowOffset + c;
        const rippleShift = Math.round(
          Math.sin(r * 0.72 - t * 2.15 + c * 0.13) * (0.5 + depth * 1.5)
        );
        const sampleC = clamp(c + rippleShift, 0, cols - 1);

        const waveNoise = valueNoise2D(c * 0.085 + t * 0.18, r * 0.34 - t * 0.25);
        const rippleWave = Math.sin(r * 1.4 - t * 2.0 + waveNoise * 3.8);
        const h = fastHash(c, r);

        let mLuma = 0;
        let mTier = 0;
        let mChar = 0;
        if (mirrorR >= 0 && mirrorR < horizonRow) {
          const mIdx = mirrorR * cols + sampleC;
          mLuma = this.skyLumas[mIdx];
          mTier = this.skyTiers[mIdx];
          mChar = this.skyChars[mIdx];
        }

        const fadeByDepth = 1.0 - depth * 0.58;
        const isBrightSource =
          mLuma > 0.32 && (mTier === 6 || mTier === 7 || mTier === 8 || mTier === 9 || mTier === 2);

        if (isBrightSource && rippleWave > -0.25) {
          // Shimmering vertical reflection of lit windows, beacons, train & moon/sun
          const shimmer = 0.55 + 0.45 * rippleWave;
          buffers.lumas[idx] = clamp(mLuma * fadeByDepth * (0.65 + 0.35 * shimmer), 0.14, 0.92);
          buffers.tiers[idx] = mTier === 8 ? 8 : mTier === 7 ? 7 : 11;
          buffers.charCodes[idx] =
            shimmer > 0.72 ? CH_EQUALS : shimmer > 0.42 ? CH_TILDE : CH_DASH;
        } else if (mLuma > 0.15 && (mTier === 3 || mTier === 4 || mTier === 5) && rippleWave > 0.12) {
          // Subtle inverted building silhouette reflection on water
          buffers.lumas[idx] = clamp(0.24 * fadeByDepth, 0.08, 0.36);
          buffers.tiers[idx] = 10;
          buffers.charCodes[idx] = h > 0.55 ? CH_DASH : CH_DOT;
        } else if (rippleWave > 0.58 && h > 0.28) {
          // Ambient harbor water ripples
          buffers.lumas[idx] = clamp((0.18 + 0.16 * waveNoise) * fadeByDepth, 0.06, 0.36);
          buffers.tiers[idx] = 10;
          buffers.charCodes[idx] =
            rippleWave > 0.82 ? CH_TILDE : h > 0.65 ? CH_DASH : CH_DOT;
        } else if (mChar === 0 && h > 0.965 - depth * 0.01) {
          // Rare subtle water glint
          buffers.lumas[idx] = 0.16 * fadeByDepth;
          buffers.tiers[idx] = isLight ? 10 : 11;
          buffers.charCodes[idx] = CH_DOT;
        }
      }
    }
  }

  // ==========================================================================
  // Sub-Renderers
  // ==========================================================================

  private samplePromenadeCell(
    c: number,
    cols: number,
    isPhone: boolean,
    isLight: boolean,
    t: number,
    traffic1Col: number,
    traffic2Col: number,
    out: CellSample
  ): void {
    // Moving street traffic streaks along the waterfront promenade
    const d1 = c - traffic1Col; // moving left
    if (d1 >= 0 && d1 <= (isPhone ? 2 : 3)) {
      out.charCode = d1 === 0 ? CH_STAR : CH_DASH;
      out.luma = d1 === 0 ? 0.94 : 0.62;
      out.tier = d1 === 0 ? 9 : 8;
      return;
    }

    const d2 = traffic2Col - c; // moving right
    if (d2 >= 0 && d2 <= (isPhone ? 2 : 3)) {
      out.charCode = d2 === 0 ? CH_STAR : CH_DASH;
      out.luma = d2 === 0 ? 0.94 : 0.62;
      out.tier = d2 === 0 ? 9 : 8;
      return;
    }

    // Spaced promenade streetlights along the seawall
    const lampSpacing = isPhone ? 9 : 14;
    if (c > 1 && c < cols - 2 && c % lampSpacing === 0) {
      const shimmer = 0.85 + 0.15 * Math.sin(t * 2.1 + c);
      out.charCode = CH_STAR;
      out.luma = (isLight ? 0.55 : 0.86) * shimmer;
      out.tier = 6;
      return;
    }

    out.charCode = c % 3 === 0 ? CH_EQUALS : CH_UNDERSCORE;
    out.luma = isLight ? 0.56 : 0.44;
    out.tier = 5;
  }

  private sampleBuildingCell(
    b: BuildingDef,
    r: number,
    pCol: number,
    isLight: boolean,
    isPhone: boolean,
    t: number,
    out: CellSample
  ): boolean {
    // 1) Rooftop radio beacon (at spire tip or roof corner)
    if (b.hasBeacon && pCol >= b.beaconCol - 1 && pCol <= b.beaconCol + 1 && r >= b.beaconRow - 1 && r <= b.beaconRow + 1) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.35 + b.beaconPhase);
      if (pCol === b.beaconCol && r === b.beaconRow) {
        if (pulse > 0.52) {
          out.charCode = pulse > 0.82 ? CH_AT : CH_STAR;
          out.luma = 0.72 + 0.27 * pulse;
          out.tier = 8;
        } else {
          out.charCode = CH_APOS;
          out.luma = 0.32;
          out.tier = 5;
        }
        return true;
      }
      // Subtle 1-cell halo on peak pulse in dark mode
      if (!isLight && pulse > 0.84 && (pCol === b.beaconCol || r === b.beaconRow)) {
        out.charCode = CH_DOT;
        out.luma = 0.36 * ((pulse - 0.84) / 0.16);
        out.tier = 8;
        return true;
      }
    }

    // 2) Spire mast above roof
    if (b.spireCol === pCol && r >= b.spireTopRow && r < b.wallTopRow) {
      out.charCode = r === b.spireTopRow ? CH_CARET : CH_PIPE;
      out.luma = b.layer === 2 ? 0.68 : 0.44;
      out.tier = b.layer === 2 ? 5 : 4;
      return true;
    }

    // 3) Rooftop water tower / mechanical penthouse on flat roofs
    if (b.hasWaterTower && r >= b.wallTopRow - 2 && r < b.wallTopRow) {
      const towerCenter = b.startCol + Math.floor(b.width * 0.65);
      const dx = pCol - towerCenter;
      if (Math.abs(dx) <= 1) {
        if (r === b.wallTopRow - 2) {
          out.charCode = dx === -1 ? CH_LBRACK : dx === 1 ? CH_RBRACK : CH_EQUALS;
        } else {
          out.charCode = dx === 0 ? CH_SPACE : CH_PIPE;
        }
        out.luma = b.layer === 2 ? 0.54 : 0.36;
        out.tier = b.layer === 2 ? 5 : 4;
        return true;
      }
    }

    if (r < b.wallTopRow || r >= this.horizonRow) {
      return false;
    }

    // Check span at row r (for stepped, crown, peaked, slanted roofs)
    const { left, right, prevLeft, prevRight } = this.getSpanAtRow(b, r);
    if (pCol < left || pCol > right) {
      return false;
    }

    const spanW = right - left + 1;
    const localCol = pCol - left;
    const localRow = r - b.wallTopRow;

    // ------------------------------------------------------------------------
    // Far Layer (Layer 0): Soft distant architectural silhouettes
    // ------------------------------------------------------------------------
    if (b.layer === 0) {
      const isTop = r === b.wallTopRow || pCol < prevLeft || pCol > prevRight;
      if (isTop) {
        out.charCode = CH_UNDERSCORE;
        out.luma = isLight ? 0.34 : 0.28;
        out.tier = 3;
        return true;
      }
      if (localCol === 0 || localCol === spanW - 1) {
        out.charCode = CH_PIPE;
        out.luma = isLight ? 0.32 : 0.26;
        out.tier = 3;
        return true;
      }
      // Sparse tiny distant lights at night / subtle vertical mullions by day
      const winHash = fastHash(pCol + b.seed, r);
      if (!isLight && localRow % 2 === 1 && localCol % 2 === 1 && winHash > 0.76) {
        const flicker = Math.sin(t * 0.14 + winHash * 30);
        if (flicker > -0.3) {
          out.charCode = winHash > 0.90 ? CH_COLON : CH_DOT;
          out.luma = 0.38;
          out.tier = winHash > 0.86 ? 6 : 3;
          return true;
        }
      }
      if (isLight && localCol % 3 === 0 && localRow % 2 === 1) {
        out.charCode = CH_COLON;
        out.luma = 0.22;
        out.tier = 3;
      }
      return true;
    }

    // ------------------------------------------------------------------------
    // Midground & Foreground Layers (Layer 1 & 2): Crisp Skyline Architecture
    // ------------------------------------------------------------------------
    const isFore = b.layer === 2;
    const isRoofRow = r === b.wallTopRow;
    const isSlopedRoof =
      b.roofType === 'slantLeft' || b.roofType === 'slantRight' || b.roofType === 'peaked';
    const isStepShoulder =
      !isSlopedRoof && prevRight >= prevLeft && (pCol < prevLeft || pCol > prevRight);

    // Slanted roofline diagonals
    const slopeRows = Math.max(2, Math.round((this.horizonRow - b.wallTopRow) * 0.16));
    if (
      (b.roofType === 'slantRight' || b.roofType === 'peaked') &&
      r < b.wallTopRow + slopeRows &&
      localCol === spanW - 1 &&
      prevRight < right
    ) {
      out.charCode = CH_BSLASH;
      out.luma = isFore ? 0.78 : 0.54;
      out.tier = isFore ? 5 : 4;
      return true;
    }
    if (
      (b.roofType === 'slantLeft' || b.roofType === 'peaked') &&
      r < b.wallTopRow + slopeRows &&
      localCol === 0 &&
      prevLeft > left
    ) {
      out.charCode = CH_SLASH;
      out.luma = isFore ? 0.78 : 0.54;
      out.tier = isFore ? 5 : 4;
      return true;
    }

    if (isRoofRow || isStepShoulder) {
      out.charCode = CH_UNDERSCORE;
      out.luma = isFore ? 0.76 : 0.52;
      out.tier = isFore ? 5 : 4;
      return true;
    }

    // Left / right vertical skyscraper walls
    if (localCol === 0 || localCol === spanW - 1) {
      out.charCode = CH_PIPE;
      if (isLight && localCol === spanW - 1) {
        // Golden-hour sun-catching eastern edge
        out.luma = isFore ? 0.78 : 0.56;
        out.tier = 6;
      } else {
        out.luma = isFore ? 0.74 : 0.50;
        out.tier = isFore ? 5 : 4;
      }
      return true;
    }

    // Architectural interior: windows, mullions & spandrels
    const winStepX = isPhone ? 1 : 2;
    const isFloorLine = localRow % 2 === 0;
    const winColIdx = Math.floor((localCol - 1) / winStepX);
    const winRowIdx = Math.floor(localRow / 2);
    const winHash = fastHash(winColIdx + b.seed, winRowIdx + b.id * 17);

    // Subtle slow office-light transitions (never frantic)
    const slowCycle = Math.sin(t * 0.16 + winHash * 52.0);
    const subtleFlicker = winHash > 0.94 ? 0.75 + 0.25 * Math.sin(t * 4.5 + winHash * 99) : 1.0;

    if (isLight) {
      // Crisp daytime / golden-hour shading + clean glass reflections
      const rightSideBias = localCol / Math.max(1, spanW - 1);
      if (isFloorLine) {
        if (b.windowStyle === 2 || winHash > 0.55) {
          out.charCode = CH_DASH;
          out.luma = isFore ? 0.36 : 0.26;
          out.tier = isFore ? 4 : 3;
        }
        return true;
      }

      if (b.windowStyle === 1) {
        // Curtain-wall glass tower
        if (localCol % 2 === 0) {
          out.charCode = CH_PIPE;
          out.luma = 0.44;
          out.tier = 4;
        } else if (rightSideBias > 0.62 && winHash > 0.48) {
          out.charCode = winHash > 0.78 ? CH_EQUALS : CH_PLUS;
          out.luma = 0.64;
          out.tier = 6; // golden sun reflection
        } else if (winHash > 0.35) {
          out.charCode = CH_COLON;
          out.luma = 0.46;
          out.tier = 7; // cool cerulean sky glass
        }
        return true;
      }

      if (rightSideBias > 0.68 && winHash > 0.52) {
        out.charCode = CH_EQUALS;
        out.luma = 0.60;
        out.tier = 6;
      } else if (localCol % 2 === 1 && winHash > 0.38) {
        out.charCode = winHash > 0.68 ? CH_COLON : CH_DASH;
        out.luma = isFore ? 0.48 : 0.36;
        out.tier = winHash > 0.55 ? 7 : 4;
      } else if (localCol % 3 === 0) {
        out.charCode = CH_PIPE;
        out.luma = 0.28;
        out.tier = 4;
      }
      return true;
    }

    // ------------------------------------------------------------------------
    // Dark Mode Night Windows (clean dark silhouettes + crisp lit windows)
    // ------------------------------------------------------------------------
    // Illuminated rooftop penthouse crown band
    if (localRow === 1 && isFore && spanW >= 5) {
      out.charCode = CH_EQUALS;
      out.luma = 0.84;
      out.tier = b.windowStyle === 1 ? 7 : 6;
      return true;
    }

    if (b.windowStyle === 0) {
      // Classic Punched Office Grid
      if (isFloorLine) {
        if (!isPhone && localCol % 2 === 0) {
          out.charCode = CH_DASH;
          out.luma = 0.22;
          out.tier = isFore ? 4 : 3;
        }
        return true;
      }
      const litThresh = isFore ? 0.56 : 0.65;
      const isLit = winHash + slowCycle * 0.08 > litThresh;
      if (isLit && (isPhone || localCol % 2 === 1)) {
        out.charCode = winHash > 0.84 ? CH_HASH : winHash > 0.68 ? CH_EQUALS : CH_PLUS;
        out.luma = (isFore ? 0.84 : 0.60) * subtleFlicker;
        out.tier = winHash > 0.74 ? 6 : 7;
        return true;
      }
      if (!isPhone && localCol % 3 === 0) {
        out.charCode = CH_PIPE;
        out.luma = 0.18;
        out.tier = 4;
      }
      return true;
    }

    if (b.windowStyle === 1) {
      // Glass Curtain Wall (vertical mullions + multi-cell office bands)
      if (!isPhone && localCol % 3 === 0) {
        out.charCode = CH_PIPE;
        out.luma = 0.28;
        out.tier = 4;
        return true;
      }
      const officeRowHash = fastHash(Math.floor(winColIdx / 2) + b.seed, localRow);
      const isLitBand = officeRowHash + slowCycle * 0.06 > (isFore ? 0.58 : 0.68);
      if (isLitBand) {
        out.charCode = localRow % 2 === 1 ? CH_EQUALS : CH_COLON;
        out.luma = (isFore ? 0.80 : 0.56) * subtleFlicker;
        out.tier = officeRowHash > 0.78 ? 7 : 6;
        return true;
      }
      if (isFloorLine && localCol % 2 === 0) {
        out.charCode = CH_DASH;
        out.luma = 0.18;
        out.tier = 3;
      }
      return true;
    }

    if (b.windowStyle === 2) {
      // Horizontal Ribbon Windows
      if (isFloorLine) {
        if (localCol % 2 === 1) {
          out.charCode = CH_DASH;
          out.luma = 0.22;
          out.tier = 4;
        }
        return true;
      }
      const floorHash = fastHash(b.seed + winRowIdx, Math.floor(winColIdx / 3));
      if (floorHash + slowCycle * 0.07 > 0.54) {
        out.charCode = floorHash > 0.78 ? CH_EQUALS : CH_COLON;
        out.luma = (isFore ? 0.78 : 0.54) * subtleFlicker;
        out.tier = floorHash > 0.72 ? 7 : 6;
        return true;
      }
      return true;
    }

    // Style 3: Warm Mixed Residential Apartments
    if (isFloorLine) {
      return true;
    }
    const isApartmentLit = winHash + slowCycle * 0.1 > 0.58;
    if (isApartmentLit && (isPhone || localCol % 2 === 1)) {
      out.charCode = winHash > 0.86 ? CH_STAR : winHash > 0.72 ? CH_HASH : CH_EQUALS;
      out.luma = (isFore ? 0.86 : 0.64) * subtleFlicker;
      out.tier = winHash > 0.88 ? 7 : 6;
      return true;
    }
    if (!isPhone && localCol % 4 === 0) {
      out.charCode = CH_COLON;
      out.luma = 0.18;
      out.tier = 3;
    }
    return true;
  }

  private sampleBridgeCell(
    r: number,
    c: number,
    cols: number,
    deckRow: number,
    isPhone: boolean,
    isLight: boolean,
    t: number,
    trainHeadCol: number,
    trainLen: number,
    out: CellSample
  ): boolean {
    const tL = this.bridgeTowerLeftCol;
    const tR = this.bridgeTowerRightCol;
    const topR = this.bridgeTowerTopRow;
    const spanStart = Math.max(1, Math.round(cols * 0.04));
    const spanEnd = Math.min(cols - 2, Math.round(cols * 0.92));

    if (c < spanStart || c > spanEnd || r < topR - 1 || r > this.horizonRow - 1) {
      return false;
    }

    // Twin Bridge Pylons / Towers
    const isLeftTower = Math.abs(c - tL) <= (isPhone ? 0 : 1);
    const isRightTower = Math.abs(c - tR) <= (isPhone ? 0 : 1);
    if ((isLeftTower || isRightTower) && r >= topR && r < this.horizonRow) {
      if (r === topR && (c === tL || c === tR)) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + (isLeftTower ? 0.5 : 2.2));
        out.charCode = pulse > 0.58 ? CH_STAR : CH_CARET;
        out.luma = pulse > 0.58 ? 0.90 : 0.56;
        out.tier = pulse > 0.58 ? 8 : 5;
        return true;
      }
      if (r === topR + 2 && !isPhone) {
        out.charCode = CH_EQUALS;
      } else {
        out.charCode = c === tL || c === tR ? (r % 2 === 0 ? CH_HASH : CH_PIPE) : CH_PIPE;
      }
      out.luma = isLight ? 0.72 : 0.64;
      out.tier = 5;
      return true;
    }

    // Animated Elevated Train gliding across deckRow - 1!
    if (r === deckRow - 1) {
      const distFromHead = trainHeadCol - c;
      if (distFromHead >= 0 && distFromHead < trainLen) {
        if (distFromHead === 0) {
          out.charCode = CH_GT;
          out.luma = 0.98;
          out.tier = 9; // bright headlight
        } else if (distFromHead === trainLen - 1) {
          out.charCode = CH_LT;
          out.luma = 0.88;
          out.tier = 8; // crimson tail-light
        } else {
          const isCarGap = !isPhone && distFromHead % 4 === 0;
          out.charCode = isCarGap ? CH_DASH : CH_EQUALS;
          out.luma = isCarGap ? 0.58 : 0.90;
          out.tier = isCarGap ? 5 : 6;
        }
        return true;
      }
    }

    // Viaduct / Suspension Bridge Roadway Deck
    if (r === deckRow) {
      const lampStep = isPhone ? 6 : 9;
      if (c % lampStep === 0) {
        out.charCode = CH_STAR;
        out.luma = isLight ? 0.66 : 0.86;
        out.tier = 6;
      } else {
        out.charCode = c % 2 === 0 ? CH_EQUALS : CH_DASH;
        out.luma = 0.66;
        out.tier = 5;
      }
      return true;
    }

    // Bridge Under-Deck Truss Struts (row below deck)
    if (r === deckRow + 1 && c % (isPhone ? 4 : 6) === 0) {
      out.charCode = CH_PIPE;
      out.luma = 0.44;
      out.tier = 5;
      return true;
    }

    // Parabolic Main Suspension Cables + Vertical Suspender Ropes
    if (r > topR && r < deckRow) {
      const sagDrop = Math.max(3, deckRow - topR - 1);
      let cableRow = -1;
      let slope = 0;

      if (c >= tL && c <= tR) {
        // Center main span parabola from tL to tR
        const mid = (tL + tR) * 0.5;
        const half = Math.max(1, (tR - tL) * 0.5);
        const x = (c - mid) / half; // -1..1
        cableRow = topR + (1 - x * x) * sagDrop;
        slope = (-2 * x * sagDrop) / half;
      } else if (c < tL) {
        // Left side span
        const x = (tL - c) / Math.max(1, tL - spanStart);
        cableRow = topR + Math.pow(x, 0.85) * sagDrop;
        slope = -sagDrop / Math.max(1, tL - spanStart);
      } else {
        // Right side span
        const x = (c - tR) / Math.max(1, spanEnd - tR);
        cableRow = topR + Math.pow(x, 0.85) * sagDrop;
        slope = sagDrop / Math.max(1, spanEnd - tR);
      }

      const cRowInt = Math.round(cableRow);
      if (Math.abs(r - cableRow) <= 0.65) {
        out.charCode =
          Math.abs(slope) < 0.16 ? CH_UNDERSCORE : slope > 0 ? CH_BSLASH : CH_SLASH;
        out.luma = 0.58;
        out.tier = 5;
        return true;
      }

      const hangerStep = isPhone ? 4 : 5;
      if (r > cRowInt && c % hangerStep === 0) {
        out.charCode = CH_PIPE;
        out.luma = 0.34;
        out.tier = 4;
        return true;
      }
    }

    return false;
  }

  private sampleSkyCell(
    r: number,
    c: number,
    cols: number,
    horizonRow: number,
    celestialCol: number,
    celestialRow: number,
    shiftSkyY: number,
    isPhone: boolean,
    isLight: boolean,
    t: number,
    out: CellSample
  ): void {
    const skyHeight = Math.max(1, horizonRow);
    const vSky = r / skyHeight;

    // 1) Crescent Moon (dark) or Golden-Hour Sun (light)
    const dx = c - celestialCol;
    const dy = (r - celestialRow) * 1.75; // aspect correction for ~2:1 tall monospace cells
    const dist = Math.hypot(dx, dy);

    const celestialR = isLight ? (isPhone ? 2.1 : 3.0) : isPhone ? 2.0 : 2.9;

    if (isLight) {
      if (dist <= celestialR) {
        out.charCode = dist < celestialR * 0.55 ? CH_AT : CH_STAR;
        out.luma = 0.94 - dist * 0.08;
        out.tier = 2;
        return;
      }
      if (dist <= celestialR + 1.4 && fastHash(c, r) > 0.48) {
        out.charCode = CH_DOT;
        out.luma = 0.40;
        out.tier = 2;
        return;
      }
    } else {
      if (dist <= celestialR) {
        // Subtract shifted circle to form a clean crescent moon
        const cutDist = Math.hypot(dx - (isPhone ? 1.0 : 1.4), dy + 0.2);
        if (cutDist > celestialR * 0.86) {
          out.charCode =
            dy < -celestialR * 0.55
              ? CH_DOT
              : dy > celestialR * 0.55
                ? CH_APOS
                : dx < -0.2
                  ? CH_LPAREN
                  : CH_STAR;
          out.luma = 0.92;
          out.tier = 2;
          return;
        }
      }
    }

    // 2) Drifting Clouds / Atmospheric Haze (upper 58% of sky, keeping clear halo around sun/moon)
    if (vSky < 0.62 && dist > celestialR + 2.4) {
      const cloudX = (c / Math.max(1, cols)) * (isPhone ? 4.2 : 7.5) - t * 0.018;
      const cloudY = ((r + shiftSkyY) / skyHeight) * 6.0;
      const cNoise = fbm(cloudX, cloudY, 3);
      const bandMask = smoothstep(0.03, 0.14, vSky) * (1.0 - smoothstep(0.38, 0.62, vSky));
      const cloudVal = (cNoise - 0.48) * bandMask * 2.2;

      if (cloudVal > 0.12) {
        if (isLight) {
          // Crisp cumulus clouds with sunlit highlights
          out.charCode =
            cloudVal > 0.45 ? CH_EQUALS : cloudVal > 0.28 ? CH_TILDE : CH_COLON;
          out.luma = clamp(0.45 + cloudVal * 0.65, 0.35, 0.92);
          out.tier = cloudVal > 0.42 && vSky > 0.2 ? 2 : 1;
        } else {
          // Subtle soft night-sky haze
          out.charCode = cloudVal > 0.36 ? CH_TILDE : cloudVal > 0.22 ? CH_DASH : CH_DOT;
          out.luma = clamp(0.18 + cloudVal * 0.42, 0.12, 0.44);
          out.tier = 1;
        }
        return;
      }
    }

    // 3) Night Sky Stars (dark mode only, upper 55% of sky)
    if (!isLight && vSky < 0.56) {
      const starHash = fastHash(c * 3 + 17, r * 5 + 31);
      if (starHash > 0.986) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * 1.45 + starHash * 140.0);
        if (twinkle > 0.35) {
          out.charCode =
            starHash > 0.996 && twinkle > 0.78
              ? CH_STAR
              : starHash > 0.992
                ? CH_PLUS
                : CH_DOT;
          out.luma = clamp((0.36 + (starHash - 0.986) * 40.0) * twinkle, 0.16, 0.85);
          out.tier = starHash > 0.995 ? 2 : 0;
        }
      }
    }
  }
}

export const cityScene: AsciiScene = new ProceduralCityScene();
