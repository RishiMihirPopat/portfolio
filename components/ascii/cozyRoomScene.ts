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

// 12 semantic color tiers (within MAX_SCENE_TIERS = 12)
const TIER_SHADOW = 0; // Interior wall & deep curtain shadow
const TIER_WOOD = 1; // Window frame, mullions, sill, desk woodgrain
const TIER_CURTAIN = 2; // Draped side curtains
const TIER_SKY = 3; // Night stars/clouds/glass sheen or daytime clouds
const TIER_CITY = 4; // Skyscraper silhouettes & suspension bridge
const TIER_COOL_WIN = 5; // Cool cyan city windows, glass glint, river shimmer
const TIER_WARM_WIN = 6; // Warm golden city windows & bridge lights
const TIER_LAMP_GLOW = 7; // Warm desk lamp pool, lampshade, mug ceramic
const TIER_BRIGHT = 8; // Lamp bulb, moon/sun highlight, bright rim/foam
const TIER_STEAM = 9; // Rising coffee steam wisps & soft air dust motes
const TIER_PLANT = 10; // Potted plant foliage
const TIER_ACCENT = 11; // Tower beacons, terracotta pot, candle flame, books

const DARK_PALETTE: ScenePalette = [
  'hsla(222, 24%, 28%, 0.44)', // 0: shadow
  'hsla(26, 38%, 46%, 0.74)',  // 1: warm walnut wood
  'hsla(20, 28%, 52%, 0.64)',  // 2: cozy draped curtains
  'hsla(214, 44%, 64%, 0.54)', // 3: night sky stars, clouds & glass sheen
  'hsla(218, 30%, 52%, 0.64)', // 4: skyscraper & bridge silhouettes
  'hsla(192, 60%, 72%, 0.80)', // 5: cool cyan city windows & water shimmer
  'hsla(38, 88%, 68%, 0.90)',  // 6: warm amber city windows & bridge lights
  'hsla(35, 86%, 76%, 0.90)',  // 7: warm lamp glow & illuminated desk/mug
  'hsla(44, 96%, 93%, 0.98)',  // 8: bright bulb core & moon highlight
  'hsla(36, 42%, 88%, 0.72)',  // 9: rising coffee steam wisps
  'hsla(142, 42%, 56%, 0.80)', // 10: potted plant leaves
  'hsla(10, 88%, 66%, 0.92)',  // 11: beacons, terracotta & candle flame
];

const LIGHT_PALETTE: ScenePalette = [
  'hsla(215, 22%, 34%, 0.36)', // 0: soft wall/curtain shadow
  'hsla(26, 48%, 28%, 0.78)',  // 1: warm sunlit oak wood
  'hsla(30, 32%, 38%, 0.60)',  // 2: sunlit linen curtains
  'hsla(204, 40%, 42%, 0.44)', // 3: daytime clouds & glass reflection
  'hsla(212, 34%, 30%, 0.68)', // 4: daytime skyscraper silhouettes
  'hsla(196, 52%, 36%, 0.56)', // 5: crisp glass facade & river glint
  'hsla(34, 74%, 36%, 0.84)',  // 6: golden-hour window glint & warm brass
  'hsla(30, 58%, 32%, 0.86)',  // 7: sunlit desk highlights & mug/lamp shade
  'hsla(44, 72%, 96%, 0.94)',  // 8: bright sunlit highlight & cloud crown
  'hsla(206, 22%, 36%, 0.56)', // 9: soft steam wisps readable over bright sky
  'hsla(146, 46%, 28%, 0.84)', // 10: vibrant botanical foliage
  'hsla(14, 62%, 40%, 0.86)',  // 11: terracotta pot, beacons & book accents
];

const CODE_SPACE = 32;

type RoofType = 'flat' | 'stepped' | 'spire' | 'slanted';

interface BuildingSpec {
  left: number;
  width: number;
  height: number;
  roofType: RoofType;
  slantDir: -1 | 1;
  hasBeacon: boolean;
  winStrideC: number;
  winStrideR: number;
  seed: number;
}

interface RoomLayout {
  cols: number;
  rows: number;
  isPhone: boolean;
  leftCurtainOuter: number;
  curtainLeftW: number;
  curtainRightW: number;
  winLeft: number;
  winRight: number;
  winTop: number;
  winBottom: number;
  winW: number;
  winH: number;
  mullion1: number;
  mullion2: number;
  transomRow: number;
  sillTop: number;
  sillBottom: number;
  deskTop: number;
}

interface CachedSkyline {
  key: string;
  skySpan: number;
  skyPad: number;
  winH: number;
  farHeight: Int16Array;
  midBuildings: BuildingSpec[];
  midColumnMap: Int16Array;
  bridgeLeft: number;
  bridgeRight: number;
  bridgeTower1: number;
  bridgeTower2: number;
  bridgeTowerTop: number;
  bridgeDeckRow: number;
}

let cachedSkyline: CachedSkyline | null = null;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fastHash(a: number, b: number): number {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const aa = fastHash(xi, yi);
  const ba = fastHash(xi + 1, yi);
  const ab = fastHash(xi, yi + 1);
  const bb = fastHash(xi + 1, yi + 1);
  const x1 = aa + u * (ba - aa);
  const x2 = ab + u * (bb - ab);
  return x1 + v * (x2 - x1);
}

function computeLayout(cols: number, rows: number, isPhone: boolean): RoomLayout {
  if (isPhone) {
    const curtainLeftW = Math.max(4, Math.round(cols * 0.075));
    const curtainRightW = curtainLeftW;
    const leftCurtainOuter = 0;
    const winLeft = curtainLeftW;
    const winRight = cols - 1 - curtainRightW;
    // Start strictly below the mobile header so curtain rod & frame are never clipped
    const winTop = Math.max(9, Math.round(rows * 0.105));
    const winBottom = Math.round(rows * 0.62);
    const sillTop = winBottom + 1;
    const sillBottom = sillTop + 1;
    const deskTop = sillBottom + 2;
    const winW = Math.max(20, winRight - winLeft + 1);
    const winH = Math.max(18, winBottom - winTop + 1);
    const mullion1 = winLeft + Math.round(winW * 0.34);
    const mullion2 = winLeft + Math.round(winW * 0.67);
    const transomRow = winTop + Math.max(4, Math.round(winH * 0.18));

    return {
      cols,
      rows,
      isPhone,
      leftCurtainOuter,
      curtainLeftW,
      curtainRightW,
      winLeft,
      winRight,
      winTop,
      winBottom,
      winW,
      winH,
      mullion1,
      mullion2,
      transomRow,
      sillTop,
      sillBottom,
      deskTop,
    };
  }

  // Desktop: keep left study wall clean behind the Home hero block (up to ~42% width),
  // and frame the panoramic city window across the right ~50% of the viewport.
  const curtainLeftW = Math.max(8, Math.round(cols * 0.052));
  const curtainRightW = Math.max(8, Math.round(cols * 0.065));
  const leftCurtainOuter = Math.round(cols * 0.37);
  const winLeft = leftCurtainOuter + curtainLeftW + 1;
  const winRight = cols - 1 - curtainRightW - 1;
  // Start strictly below the desktop header so curtain rod & window lintel stay 100% visible
  const winTop = Math.max(10, Math.round(rows * 0.105));
  const winBottom = Math.round(rows * 0.68);
  const sillTop = winBottom + 1;
  const sillBottom = sillTop + 2;
  const deskTop = sillBottom + 3;
  const winW = Math.max(30, winRight - winLeft + 1);
  const winH = Math.max(20, winBottom - winTop + 1);
  const mullion1 = winLeft + Math.round(winW * 0.34);
  const mullion2 = winLeft + Math.round(winW * 0.67);
  const transomRow = winTop + Math.max(4, Math.round(winH * 0.18));

  return {
    cols,
    rows,
    isPhone,
    leftCurtainOuter,
    curtainLeftW,
    curtainRightW,
    winLeft,
    winRight,
    winTop,
    winBottom,
    winW,
    winH,
    mullion1,
    mullion2,
    transomRow,
    sillTop,
    sillBottom,
    deskTop,
  };
}

function buildSkyline(layout: RoomLayout): CachedSkyline {
  const skyPad = 14;
  const skySpan = layout.winW + skyPad * 2;
  const winH = layout.winH;
  const key = `${layout.cols}x${layout.rows}:${layout.isPhone ? 1 : 0}`;

  if (cachedSkyline && cachedSkyline.key === key) {
    return cachedSkyline;
  }

  const farHeight = new Int16Array(skySpan);
  let fc = 0;
  let farIdx = 0;
  while (fc < skySpan) {
    const hHash = fastHash(farIdx * 17 + 3, 91);
    const w = layout.isPhone
      ? 3 + Math.floor(fastHash(farIdx * 11, 7) * 4)
      : 4 + Math.floor(fastHash(farIdx * 11, 7) * 6);
    const uCenter = (fc + w * 0.5 - skyPad) / Math.max(1, layout.winW);
    const bayDip = uCenter > 0.30 && uCenter < 0.62 ? 0.72 : 1.0;
    const h = Math.max(4, Math.round(winH * (0.28 + hHash * 0.38) * bayDip));
    const gap = fastHash(farIdx * 23, 5) > 0.65 ? 1 : 0;
    for (let x = fc; x < Math.min(skySpan, fc + w); x++) {
      farHeight[x] = h;
    }
    fc += w + gap;
    farIdx++;
  }

  const midBuildings: BuildingSpec[] = [];
  const midColumnMap = new Int16Array(skySpan).fill(-1);

  let mc = 1;
  let bIdx = 0;
  while (mc < skySpan - 2) {
    const uSky = (mc - skyPad) / Math.max(1, layout.winW);
    const r1 = fastHash(bIdx * 31 + 5, 19);
    const r2 = fastHash(bIdx * 43 + 9, 37);
    const r3 = fastHash(bIdx * 59 + 13, 53);

    const inHarborBay = uSky > 0.33 && uSky < 0.58;
    const w = layout.isPhone
      ? 4 + Math.floor(r1 * 4)
      : 5 + Math.floor(r1 * 7);

    if (inHarborBay && r2 > 0.36) {
      mc += Math.max(3, Math.floor(w * 0.8));
      bIdx++;
      continue;
    }

    const maxFrac = inHarborBay ? 0.34 : uSky > 0.62 || uSky < 0.28 ? 0.68 : 0.54;
    const minFrac = inHarborBay ? 0.16 : 0.26;
    const height = Math.max(
      5,
      Math.round(winH * (minFrac + r2 * (maxFrac - minFrac)))
    );

    let roofType: RoofType = 'flat';
    if (r3 > 0.72 && height > winH * 0.42 && w >= 5) {
      roofType = 'spire';
    } else if (r3 > 0.46 && w >= 6) {
      roofType = 'stepped';
    } else if (r3 > 0.24 && w >= 5) {
      roofType = 'slanted';
    }

    const spec: BuildingSpec = {
      left: mc,
      width: Math.min(w, skySpan - mc),
      height,
      roofType,
      slantDir: r1 > 0.5 ? 1 : -1,
      hasBeacon: roofType === 'spire' || (height > winH * 0.52 && r2 > 0.55),
      winStrideC: 2,
      winStrideR: 2,
      seed: bIdx * 97 + 13,
    };

    const specIndex = midBuildings.length;
    midBuildings.push(spec);
    for (let x = spec.left; x < spec.left + spec.width && x < skySpan; x++) {
      midColumnMap[x] = specIndex;
    }

    const gap = layout.isPhone
      ? 1 + (r3 > 0.65 ? 1 : 0)
      : 1 + Math.floor(r3 * 2.5);
    mc += spec.width + gap;
    bIdx++;
  }

  const bridgeLeft = skyPad + Math.round(layout.winW * 0.18);
  const bridgeRight = skyPad + Math.round(layout.winW * 0.66);
  const bridgeSpan = Math.max(12, bridgeRight - bridgeLeft);
  const bridgeTower1 = bridgeLeft + Math.round(bridgeSpan * 0.27);
  const bridgeTower2 = bridgeLeft + Math.round(bridgeSpan * 0.73);
  const bridgeDeckRow = Math.max(4, winH - Math.max(4, Math.round(winH * 0.19)));
  const bridgeTowerTop = Math.max(
    3,
    bridgeDeckRow - Math.max(7, Math.round(winH * 0.34))
  );

  cachedSkyline = {
    key,
    skySpan,
    skyPad,
    winH,
    farHeight,
    midBuildings,
    midColumnMap,
    bridgeLeft,
    bridgeRight,
    bridgeTower1,
    bridgeTower2,
    bridgeTowerTop,
    bridgeDeckRow,
  };

  return cachedSkyline;
}

function setCell(
  buffers: SceneCellBuffers,
  cols: number,
  rows: number,
  c: number,
  r: number,
  chCode: number,
  tier: number,
  luma: number
): void {
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  const idx = r * cols + c;
  buffers.charCodes[idx] = chCode;
  buffers.tiers[idx] = tier;
  buffers.lumas[idx] = luma;
}

function drawStr(
  buffers: SceneCellBuffers,
  cols: number,
  rows: number,
  c0: number,
  r: number,
  text: string,
  tier: number,
  luma: number,
  occludeSpaces = true
): void {
  if (r < 0 || r >= rows) return;
  for (let i = 0; i < text.length; i++) {
    const c = c0 + i;
    if (c < 0 || c >= cols) continue;
    const ch = text.charCodeAt(i);
    if (ch === CODE_SPACE) {
      if (occludeSpaces) {
        const idx = r * cols + c;
        buffers.charCodes[idx] = CODE_SPACE;
        buffers.lumas[idx] = 0;
      }
      continue;
    }
    const idx = r * cols + c;
    buffers.charCodes[idx] = ch;
    buffers.tiers[idx] = tier;
    buffers.lumas[idx] = luma;
  }
}

function drawSkyAndCity(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  skyline: CachedSkyline,
  fgShiftX: number,
  fgShiftY: number,
  skyShiftX: number,
  skyShiftY: number
): void {
  const { cols, rows, t, isLight, isPhone } = frame;
  const winLeft = layout.winLeft + fgShiftX;
  const winRight = layout.winRight + fgShiftX;
  const winTop = layout.winTop + fgShiftY;
  const winBottom = layout.winBottom + fgShiftY;

  const rStart = Math.max(0, winTop);
  const rEnd = Math.min(rows - 1, winBottom);
  const cStart = Math.max(0, winLeft);
  const cEnd = Math.min(cols - 1, winRight);

  const celestialSkyC = skyline.skyPad + Math.round(layout.winW * 0.80);
  const celestialSkyR = Math.max(3, Math.round(layout.winH * 0.21));
  const aspect = frame.cellH / Math.max(1, frame.cellW);

  const midBridgeC = (skyline.bridgeTower1 + skyline.bridgeTower2) * 0.5;
  const halfMainSpan = Math.max(2, (skyline.bridgeTower2 - skyline.bridgeTower1) * 0.5);
  const sagDepth = Math.max(4, (skyline.bridgeDeckRow - skyline.bridgeTowerTop) * 0.72);

  for (let r = rStart; r <= rEnd; r++) {
    const winR = r - winTop - skyShiftY;
    const vSky = winR / Math.max(1, layout.winH);
    const skyRowFromBottom = layout.winH - 1 - winR;

    for (let c = cStart; c <= cEnd; c++) {
      const idx = r * cols + c;
      const skyC = c - winLeft + skyline.skyPad - skyShiftX;
      const clampedSkyC = clamp(skyC, 0, skyline.skySpan - 1);

      let luma = 0;
      let tier = TIER_SKY;
      let chCode = 0;

      // 1. Sky backdrop: stars + moon (dark) or drifting clouds + sun (light)
      if (winR >= 0 && winR < layout.winH) {
        const dxCel = (skyC - celestialSkyC) / aspect;
        const dyCel = winR - celestialSkyR;
        const dCel = Math.hypot(dxCel, dyCel);

        if (isLight) {
          if (dCel < (isPhone ? 1.5 : 2.1)) {
            chCode = dCel < 1.0 ? '@'.charCodeAt(0) : '*'.charCodeAt(0);
            tier = TIER_BRIGHT;
            luma = 0.92;
          } else if (dCel < (isPhone ? 2.8 : 3.8)) {
            tier = TIER_WARM_WIN;
            luma = 0.34 * (1 - (dCel - 1.5) / 2.3);
          } else if (vSky < 0.58) {
            const cloudN = valueNoise2D(
              skyC * (isPhone ? 0.14 : 0.085) - t * 0.065,
              winR * 0.24
            );
            const cloudBand = Math.sin(vSky * Math.PI * 1.4);
            if (cloudN * cloudBand > 0.56) {
              const density = (cloudN * cloudBand - 0.56) / 0.44;
              luma = 0.26 + density * 0.55;
              tier = density > 0.45 ? TIER_BRIGHT : TIER_SKY;
              if (density > 0.55) chCode = '~'.charCodeAt(0);
            }
          }
        } else {
          const dxCut = (skyC - (celestialSkyC - 1.15)) / aspect;
          const dyCut = winR - (celestialSkyR - 0.35);
          const dCut = Math.hypot(dxCut, dyCut);
          const moonRadius = isPhone ? 1.65 : 2.35;

          if (dCel < moonRadius && dCut > moonRadius * 0.78) {
            chCode = dCel > moonRadius * 0.65 ? ')'.charCodeAt(0) : '@'.charCodeAt(0);
            tier = TIER_BRIGHT;
            luma = 0.95;
          } else if (vSky < 0.62) {
            const starHash = fastHash(skyC, winR * 3 + 7);
            if (starHash > 0.986) {
              const twinkle = 0.55 + 0.45 * Math.sin(t * 1.6 + starHash * 220);
              chCode =
                starHash > 0.996
                  ? '*'.charCodeAt(0)
                  : starHash > 0.992
                  ? '+'.charCodeAt(0)
                  : '.'.charCodeAt(0);
              tier = starHash > 0.994 ? TIER_BRIGHT : TIER_SKY;
              luma = 0.45 + 0.45 * twinkle;
            } else {
              const mist = valueNoise2D(skyC * 0.06 - t * 0.03, winR * 0.18);
              if (mist > 0.68 && vSky > 0.18) {
                luma = 0.16 + (mist - 0.68) * 0.5;
                tier = TIER_SKY;
              }
            }
          }
        }
      }

      // 2. Far skyline silhouettes
      const farH = skyline.farHeight[clampedSkyC];
      if (farH > 0 && skyRowFromBottom >= 0 && skyRowFromBottom <= farH) {
        if (skyRowFromBottom === farH) {
          chCode = '_'.charCodeAt(0);
          tier = TIER_CITY;
          luma = 0.46;
        } else {
          const farWin =
            !isLight &&
            skyRowFromBottom % 2 === 1 &&
            fastHash(skyC * 3, skyRowFromBottom * 5) > 0.86;
          if (farWin) {
            chCode = '.'.charCodeAt(0);
            tier = TIER_WARM_WIN;
            luma = 0.48;
          } else {
            chCode = (skyC + skyRowFromBottom) % 3 === 0 ? ':'.charCodeAt(0) : CODE_SPACE;
            tier = TIER_CITY;
            luma = chCode === CODE_SPACE ? 0 : 0.24;
          }
        }
      }

      // 3. Suspension Bridge
      if (
        skyC >= skyline.bridgeLeft &&
        skyC <= skyline.bridgeRight &&
        winR >= skyline.bridgeTowerTop - 2 &&
        winR <= skyline.bridgeDeckRow + 2
      ) {
        const isTower1 = Math.abs(skyC - skyline.bridgeTower1) <= 0;
        const isTower2 = Math.abs(skyC - skyline.bridgeTower2) <= 0;
        const isTowerCol = isTower1 || isTower2;

        let cableRow = 9999;
        if (skyC >= skyline.bridgeTower1 && skyC <= skyline.bridgeTower2) {
          const norm = (skyC - midBridgeC) / halfMainSpan;
          cableRow = Math.round(
            skyline.bridgeTowerTop + sagDepth * (1 - norm * norm)
          );
        } else if (skyC < skyline.bridgeTower1) {
          const frac =
            (skyline.bridgeTower1 - skyC) /
            Math.max(1, skyline.bridgeTower1 - skyline.bridgeLeft);
          cableRow = Math.round(
            skyline.bridgeTowerTop +
              (skyline.bridgeDeckRow - skyline.bridgeTowerTop) * frac
          );
        } else {
          const frac =
            (skyC - skyline.bridgeTower2) /
            Math.max(1, skyline.bridgeRight - skyline.bridgeTower2);
          cableRow = Math.round(
            skyline.bridgeTowerTop +
              (skyline.bridgeDeckRow - skyline.bridgeTowerTop) * frac
          );
        }

        if (isTowerCol && winR >= skyline.bridgeTowerTop && winR <= skyline.bridgeDeckRow + 2) {
          if (winR === skyline.bridgeTowerTop) {
            const beaconPulse = 0.5 + 0.5 * Math.sin(t * 2.8 + (isTower1 ? 0 : 1.4));
            chCode = beaconPulse > 0.55 ? '*'.charCodeAt(0) : 'o'.charCodeAt(0);
            tier = TIER_ACCENT;
            luma = isLight ? 0.72 : 0.45 + 0.5 * beaconPulse;
          } else {
            chCode = winR % 4 === 0 ? '+'.charCodeAt(0) : '|'.charCodeAt(0);
            tier = TIER_CITY;
            luma = 0.78;
          }
        } else if (winR === skyline.bridgeDeckRow) {
          const carWave1 = Math.floor((skyC - t * 4.5) % 14 + 14) % 14;
          const carWave2 = Math.floor((skyC + t * 3.2) % 19 + 19) % 19;
          if (!isLight && carWave1 === 0) {
            chCode = '*'.charCodeAt(0);
            tier = TIER_WARM_WIN;
            luma = 0.92;
          } else if (!isLight && carWave2 === 0) {
            chCode = 'o'.charCodeAt(0);
            tier = TIER_ACCENT;
            luma = 0.85;
          } else {
            chCode = '='.charCodeAt(0);
            tier = TIER_CITY;
            luma = 0.76;
          }
        } else if (winR === cableRow) {
          chCode =
            skyC < skyline.bridgeTower1
              ? '/'.charCodeAt(0)
              : skyC > skyline.bridgeTower2
              ? '\\'.charCodeAt(0)
              : Math.abs(skyC - midBridgeC) < halfMainSpan * 0.25
              ? '_'.charCodeAt(0)
              : skyC < midBridgeC
              ? '\\'.charCodeAt(0)
              : '/'.charCodeAt(0);
          tier = TIER_WARM_WIN;
          luma = isLight ? 0.62 : 0.78;
        } else if (
          winR > cableRow &&
          winR < skyline.bridgeDeckRow &&
          skyC % 3 === 0
        ) {
          chCode = ':'.charCodeAt(0);
          tier = TIER_CITY;
          luma = 0.44;
        }
      }

      // 4. Midground Hero Skyscrapers
      const bIndex = skyline.midColumnMap[clampedSkyC];
      if (bIndex >= 0) {
        const b = skyline.midBuildings[bIndex];
        const localC = clampedSkyC - b.left;
        const spireExtra = b.roofType === 'spire' ? (isPhone ? 3 : 5) : 0;

        let roofH = b.height;
        if (b.roofType === 'stepped' && (localC === 0 || localC === b.width - 1)) {
          roofH = Math.max(4, b.height - 2);
        } else if (b.roofType === 'slanted') {
          const frac = localC / Math.max(1, b.width - 1);
          const slope = b.slantDir === 1 ? frac : 1 - frac;
          roofH = Math.max(4, b.height - Math.round(slope * 3));
        }

        const isSpireCol =
          b.roofType === 'spire' && localC === Math.floor(b.width * 0.5);

        if (isSpireCol && skyRowFromBottom > roofH && skyRowFromBottom <= roofH + spireExtra) {
          if (skyRowFromBottom === roofH + spireExtra && b.hasBeacon) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 3.1 + b.seed);
            chCode = pulse > 0.5 ? '*'.charCodeAt(0) : '+'.charCodeAt(0);
            tier = TIER_ACCENT;
            luma = isLight ? 0.78 : 0.35 + 0.63 * pulse;
          } else {
            chCode = '|'.charCodeAt(0);
            tier = TIER_CITY;
            luma = 0.72;
          }
        } else if (skyRowFromBottom >= 0 && skyRowFromBottom <= roofH) {
          const isLeftEdge = localC === 0;
          const isRightEdge = localC === b.width - 1;
          const isRoof = skyRowFromBottom === roofH;

          if (isRoof) {
            chCode =
              b.roofType === 'slanted'
                ? (b.slantDir === 1 ? '\\' : '/').charCodeAt(0)
                : '_'.charCodeAt(0);
            tier = TIER_CITY;
            luma = 0.72;
          } else if (isLeftEdge || isRightEdge) {
            chCode = '|'.charCodeAt(0);
            tier = TIER_CITY;
            luma = 0.64;
          } else {
            const isWindowRow = skyRowFromBottom >= 2 && skyRowFromBottom % b.winStrideR === 0;
            const isWindowCol = localC % b.winStrideC === 1 || (b.width <= 4 && localC === 1);

            if (isWindowRow && isWindowCol) {
              const winHash = fastHash(b.seed + localC * 13, skyRowFromBottom * 19);
              if (isLight) {
                if (winHash > 0.84) {
                  chCode = '='.charCodeAt(0);
                  tier = TIER_WARM_WIN;
                  luma = 0.68;
                } else {
                  chCode = winHash > 0.45 ? ':'.charCodeAt(0) : '-'.charCodeAt(0);
                  tier = TIER_COOL_WIN;
                  luma = 0.48;
                }
              } else {
                const slowShift =
                  winHash > 0.72 && winHash < 0.80
                    ? Math.sin(t * 0.45 + b.seed + winHash * 60) > 0.2
                    : winHash > 0.48;

                if (slowShift) {
                  const warm = fastHash(b.seed + localC * 7, skyRowFromBottom * 29) > 0.28;
                  chCode =
                    winHash > 0.88
                      ? '#'.charCodeAt(0)
                      : winHash > 0.68
                      ? '='.charCodeAt(0)
                      : ':'.charCodeAt(0);
                  tier = warm ? TIER_WARM_WIN : TIER_COOL_WIN;
                  luma = 0.68 + winHash * 0.26;
                } else {
                  chCode = CODE_SPACE;
                  luma = 0;
                }
              }
            } else {
              chCode = CODE_SPACE;
              luma = 0;
            }
          }
        }
      }

      // 5. Lower city boulevard / waterfront reflections right above the sill
      if (skyRowFromBottom >= 0 && skyRowFromBottom <= 1 && bIndex < 0) {
        const shimmer = fastHash(skyC + Math.floor(t * 1.5), skyRowFromBottom);
        if (shimmer > 0.58) {
          chCode = skyRowFromBottom === 0 ? '~'.charCodeAt(0) : '-'.charCodeAt(0);
          tier = shimmer > 0.84 ? TIER_WARM_WIN : TIER_COOL_WIN;
          luma = isLight ? 0.45 : 0.62;
        }
      }

      // 6. Subtle diagonal window glass sheen
      if (chCode === 0 && luma === 0 && !isLight && winR >= 0) {
        const paneDiag = (c - winLeft + (r - winTop) * 2) % 37;
        if (paneDiag === 0 && fastHash(c, r) > 0.72) {
          chCode = '/'.charCodeAt(0);
          tier = TIER_SKY;
          luma = 0.20;
        }
      }

      buffers.charCodes[idx] = chCode;
      buffers.tiers[idx] = tier;
      buffers.lumas[idx] = luma;
    }
  }
}

function drawLeftInteriorWall(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  if (layout.isPhone) return;
  const { cols, rows } = frame;
  const wallEnd = clamp(layout.leftCurtainOuter + fgShiftX, 0, cols);
  const deskTop = layout.deskTop + fgShiftY;

  // Subtle quiet wall seam / vertical wainscoting corner next to the curtain
  const seamCol = wallEnd - 1;
  if (seamCol >= 0 && seamCol < cols) {
    for (let r = Math.max(0, layout.winTop - 2 + fgShiftY); r < Math.min(rows, deskTop); r++) {
      setCell(buffers, cols, rows, seamCol, r, '|'.charCodeAt(0), TIER_SHADOW, 0.34);
    }
  }
}

function drawWindowFrameAndSill(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  const { cols, rows } = frame;
  const winLeft = layout.winLeft + fgShiftX;
  const winRight = layout.winRight + fgShiftX;
  const winTop = layout.winTop + fgShiftY;
  const winBottom = layout.winBottom + fgShiftY;
  const m1 = layout.mullion1 + fgShiftX;
  const m2 = layout.mullion2 + fgShiftX;
  const transom = layout.transomRow + fgShiftY;
  const sillTop = layout.sillTop + fgShiftY;
  const sillBottom = layout.sillBottom + fgShiftY;

  // Top wooden lintel & frame rail
  for (let c = Math.max(0, winLeft - 1); c <= Math.min(cols - 1, winRight + 1); c++) {
    setCell(buffers, cols, rows, c, winTop - 1, '='.charCodeAt(0), TIER_WOOD, 0.74);
    if (c >= winLeft && c <= winRight) {
      const isCorner = c === winLeft || c === winRight;
      const isMull = c === m1 || c === m2;
      setCell(
        buffers,
        cols,
        rows,
        c,
        winTop,
        (isCorner || isMull ? '+' : '-').charCodeAt(0),
        TIER_WOOD,
        0.78
      );
    }
  }

  // Horizontal transom bar
  for (let c = winLeft; c <= winRight; c++) {
    const isJoint = c === winLeft || c === winRight || c === m1 || c === m2;
    setCell(
      buffers,
      cols,
      rows,
      c,
      transom,
      (isJoint ? '+' : '-').charCodeAt(0),
      TIER_WOOD,
      0.66
    );
  }

  // Vertical side jambs & center mullions
  for (let r = winTop + 1; r <= winBottom; r++) {
    setCell(buffers, cols, rows, winLeft, r, '|'.charCodeAt(0), TIER_WOOD, 0.78);
    setCell(buffers, cols, rows, winRight, r, '|'.charCodeAt(0), TIER_WOOD, 0.78);
    setCell(buffers, cols, rows, m1, r, '|'.charCodeAt(0), TIER_WOOD, 0.68);
    setCell(buffers, cols, rows, m2, r, '|'.charCodeAt(0), TIER_WOOD, 0.68);
    if (!layout.isPhone) {
      setCell(buffers, cols, rows, m1 + 1, r, '|'.charCodeAt(0), TIER_WOOD, 0.44);
      setCell(buffers, cols, rows, m2 + 1, r, '|'.charCodeAt(0), TIER_WOOD, 0.44);
    }
  }

  // Wooden window sill
  const sillLeft = Math.max(0, winLeft - 2);
  const sillRight = Math.min(cols - 1, winRight + 2);
  for (let r = sillTop; r <= sillBottom; r++) {
    for (let c = sillLeft; c <= sillRight; c++) {
      if (r === sillTop) {
        const ch = c === sillLeft || c === sillRight ? '+' : '=';
        setCell(buffers, cols, rows, c, r, ch.charCodeAt(0), TIER_WOOD, 0.84);
      } else if (r === sillBottom) {
        setCell(buffers, cols, rows, c, r, '_'.charCodeAt(0), TIER_WOOD, 0.56);
      } else {
        setCell(buffers, cols, rows, c, r, '-'.charCodeAt(0), TIER_WOOD, 0.46);
      }
    }
  }

  // Wall plaster between sill and desk
  for (let r = sillBottom + 1; r < layout.deskTop + fgShiftY; r++) {
    for (let c = sillLeft; c <= sillRight; c++) {
      const h = fastHash(c, r);
      if (h > 0.92) {
        setCell(buffers, cols, rows, c, r, '.'.charCodeAt(0), TIER_SHADOW, 0.25);
      } else {
        setCell(buffers, cols, rows, c, r, CODE_SPACE, TIER_SHADOW, 0);
      }
    }
  }
}

function drawCurtains(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  const { cols, rows, t, isPhone } = frame;
  const rodRow = Math.max(1, layout.winTop - 2 + fgShiftY);
  const bottomRow = Math.min(rows - 1, layout.deskTop - 1 + fgShiftY);
  const rodLeft = isPhone ? 0 : Math.max(0, layout.leftCurtainOuter - 1 + fgShiftX);
  const rodRight = cols - 1;

  // Curtain rod spanning cleanly above the window & curtains (never clipped at row 0)
  for (let c = rodLeft; c <= rodRight; c++) {
    const isLeftBracket = c === rodLeft;
    const isRightBracket = c === rodRight - 1;
    const inLeftRings = c > rodLeft && c < rodLeft + layout.curtainLeftW + 3;
    const inRightRings = c > cols - 1 - layout.curtainRightW - 3 && c < rodRight - 1;
    const ch = isLeftBracket
      ? '['
      : isRightBracket
      ? ']'
      : (inLeftRings || inRightRings) && c % 2 === 0
      ? 'o'
      : '-';
    setCell(buffers, cols, rows, c, rodRow, ch.charCodeAt(0), TIER_WOOD, 0.72);
  }

  const drawSide = (isLeft: boolean) => {
    const baseW = isLeft
      ? layout.curtainLeftW
      : layout.curtainRightW - Math.round(fgShiftX * 0.4);
    const maxW = Math.max(3, baseW);
    const anchorLeft = isLeft ? Math.max(0, layout.leftCurtainOuter + fgShiftX) : 0;

    for (let r = rodRow + 1; r <= bottomRow; r++) {
      const v = (r - rodRow) / Math.max(1, bottomRow - rodRow);
      const waist = Math.exp(-Math.pow((v - 0.66) * 4.5, 2));
      const flare = v > 0.72 ? (v - 0.72) * 1.15 : 0;
      const sway = Math.sin(t * 0.8 + v * 3.5) * (isPhone ? 0.18 : 0.35);
      const widthAtRow = Math.max(
        2,
        Math.round(maxW * (1.05 - 0.36 * waist + 0.18 * flare) + sway)
      );

      for (let d = 0; d < widthAtRow; d++) {
        const c = isLeft ? anchorLeft + d : cols - 1 - d;
        if (c < 0 || c >= cols) continue;

        const isInnerEdge = d === widthAtRow - 1;
        const isTieBand = Math.abs(v - 0.66) < 0.03;

        if (isTieBand && d >= widthAtRow - 3) {
          setCell(
            buffers,
            cols,
            rows,
            c,
            r,
            (isInnerEdge ? (isLeft ? ')' : '(') : '=').charCodeAt(0),
            TIER_WOOD,
            0.78
          );
        } else if (isInnerEdge) {
          const edgeChar =
            v > 0.58 && v < 0.74 ? (isLeft ? ')' : '(') : '|';
          setCell(
            buffers,
            cols,
            rows,
            c,
            r,
            edgeChar.charCodeAt(0),
            TIER_CURTAIN,
            0.76
          );
        } else {
          const pleat = 0.5 + 0.5 * Math.sin(d * (isPhone ? 1.7 : 1.35) + v * 1.8);
          if (pleat > 0.72) {
            setCell(buffers, cols, rows, c, r, '|'.charCodeAt(0), TIER_CURTAIN, 0.56);
          } else if (pleat > 0.36) {
            setCell(buffers, cols, rows, c, r, ':'.charCodeAt(0), TIER_CURTAIN, 0.40);
          } else {
            setCell(buffers, cols, rows, c, r, CODE_SPACE, TIER_SHADOW, 0);
          }
        }
      }
    }
  };

  drawSide(true);
  drawSide(false);
}

function drawPottedPlantAndCandle(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  const { cols, rows, t, isPhone, isLight } = frame;
  const sillSurfaceR = layout.sillTop + fgShiftY;
  const plantX = layout.winLeft + Math.round(layout.winW * 0.14) + fgShiftX;
  const leafSway = Math.round(Math.sin(t * 1.15) * 0.6);

  if (isPhone) {
    drawStr(buffers, cols, rows, plantX - 3 + leafSway, sillSurfaceR - 4, ' \\ | / ', TIER_PLANT, 0.80, false);
    drawStr(buffers, cols, rows, plantX - 3, sillSurfaceR - 3, '(@)Y(@)', TIER_PLANT, 0.86, false);
    drawStr(buffers, cols, rows, plantX - 2, sillSurfaceR - 2, '[===]', TIER_ACCENT, 0.82, true);
    drawStr(buffers, cols, rows, plantX - 2, sillSurfaceR - 1, '\\___/', TIER_ACCENT, 0.78, true);
  } else {
    drawStr(buffers, cols, rows, plantX - 5 + leafSway, sillSurfaceR - 6, '  \\  |  /  ', TIER_PLANT, 0.76, false);
    drawStr(buffers, cols, rows, plantX - 5 + leafSway, sillSurfaceR - 5, ' (@) Y (@) ', TIER_PLANT, 0.88, false);
    drawStr(buffers, cols, rows, plantX - 5, sillSurfaceR - 4, '(@)\\ | /(@)', TIER_PLANT, 0.84, false);
    drawStr(buffers, cols, rows, plantX - 4, sillSurfaceR - 3, ' \\ \\|/ / ', TIER_PLANT, 0.78, false);
    drawStr(buffers, cols, rows, plantX - 3, sillSurfaceR - 2, '[=====]', TIER_ACCENT, 0.84, true);
    drawStr(buffers, cols, rows, plantX - 3, sillSurfaceR - 1, ' \\___/ ', TIER_ACCENT, 0.78, true);

    const sillBookX = plantX + 8;
    drawStr(buffers, cols, rows, sillBookX, sillSurfaceR - 3, ' ||/', TIER_ACCENT, 0.74, false);
    drawStr(buffers, cols, rows, sillBookX, sillSurfaceR - 2, ' ||/', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, sillBookX, sillSurfaceR - 1, '[||]', TIER_ACCENT, 0.80, true);

    const candleX = layout.winRight - 6 + fgShiftX;
    const flicker = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 11.7) * 0.5;
    const flameCh = flicker > 0.2 ? '^' : flicker < -0.2 ? '*' : '\'';
    if (!isLight) {
      drawStr(buffers, cols, rows, candleX, sillSurfaceR - 3, flameCh, TIER_BRIGHT, 0.95, false);
    } else {
      drawStr(buffers, cols, rows, candleX, sillSurfaceR - 3, '.', TIER_ACCENT, 0.65, false);
    }
    drawStr(buffers, cols, rows, candleX - 1, sillSurfaceR - 2, '(|)', isLight ? TIER_WOOD : TIER_STEAM, 0.82, true);
    drawStr(buffers, cols, rows, candleX - 1, sillSurfaceR - 1, '|o|', TIER_ACCENT, 0.80, true);
  }
}

function drawDeskSurface(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  const { cols, rows, isLight, isPhone } = frame;
  const deskTop = layout.deskTop + fgShiftY;
  const lampBulbX = Math.round(cols * (isPhone ? 0.78 : 0.80)) + fgShiftX;
  const lampPoolCenter = lampBulbX - (isPhone ? 3 : 6);
  const poolRx = isPhone ? 22 : 44;
  const poolRy = isPhone ? 10 : 14;

  for (let r = Math.max(0, deskTop); r < rows; r++) {
    const dr = r - deskTop;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;

      const dx = (c - lampPoolCenter) / poolRx;
      const dy = (dr - 3) / poolRy;
      const dPool = Math.hypot(dx, dy);
      const poolGlow = Math.max(0, 1 - smoothstep(0.15, 1.0, dPool));

      if (dr === 0) {
        buffers.charCodes[idx] = '='.charCodeAt(0);
        buffers.tiers[idx] = poolGlow > 0.42 ? TIER_LAMP_GLOW : TIER_WOOD;
        buffers.lumas[idx] = 0.74 + poolGlow * 0.22;
      } else if (dr === 1) {
        buffers.charCodes[idx] = '-'.charCodeAt(0);
        buffers.tiers[idx] = poolGlow > 0.48 ? TIER_LAMP_GLOW : TIER_WOOD;
        buffers.lumas[idx] = 0.56 + poolGlow * 0.26;
      } else {
        const grain = valueNoise2D(c * 0.045, dr * 0.55);
        const h = fastHash(c, r);
        if (poolGlow > 0.25 && grain > 0.36) {
          buffers.charCodes[idx] = grain > 0.68 ? '~'.charCodeAt(0) : '-'.charCodeAt(0);
          buffers.tiers[idx] = poolGlow > 0.62 ? TIER_LAMP_GLOW : TIER_WOOD;
          buffers.lumas[idx] = (isLight ? 0.36 : 0.42) + poolGlow * 0.42;
        } else if (grain > 0.62 && h > 0.35) {
          buffers.charCodes[idx] = h > 0.75 ? '~'.charCodeAt(0) : '-'.charCodeAt(0);
          buffers.tiers[idx] = TIER_WOOD;
          buffers.lumas[idx] = 0.28 + (grain - 0.62) * 0.45;
        } else if (h > 0.94) {
          buffers.charCodes[idx] = '.'.charCodeAt(0);
          buffers.tiers[idx] = TIER_WOOD;
          buffers.lumas[idx] = 0.22;
        } else {
          buffers.charCodes[idx] = CODE_SPACE;
          buffers.lumas[idx] = 0;
        }
      }
    }
  }
}

function drawDeskObjects(
  frame: SceneFrameContext,
  buffers: SceneCellBuffers,
  layout: RoomLayout,
  fgShiftX: number,
  fgShiftY: number
): void {
  const { cols, rows, t, isPhone, isLight } = frame;
  const deskTop = layout.deskTop + fgShiftY;

  // 1. Desktop left-center: Stack of books & Open Notebook
  if (!isPhone) {
    const bookX = Math.round(cols * 0.24) + fgShiftX;
    const bookBase = deskTop + 3;
    drawStr(buffers, cols, rows, bookX, bookBase - 3, ' [========]', TIER_ACCENT, 0.80, true);
    drawStr(buffers, cols, rows, bookX, bookBase - 2, '[=========]', TIER_WOOD, 0.78, true);
    drawStr(buffers, cols, rows, bookX, bookBase - 1, '[==========]', TIER_CURTAIN, 0.76, true);
    drawStr(buffers, cols, rows, bookX, bookBase, '[==========]', TIER_WOOD, 0.70, true);

    const noteX = Math.round(cols * 0.44) + fgShiftX;
    const noteBase = deskTop + 3;
    drawStr(buffers, cols, rows, noteX, noteBase - 2, '  .------..------.   ', isLight ? TIER_WOOD : TIER_STEAM, 0.74, false);
    drawStr(buffers, cols, rows, noteX, noteBase - 1, ' / ~~~~ // ~~~~ /    ', isLight ? TIER_WOOD : TIER_STEAM, 0.70, true);
    drawStr(buffers, cols, rows, noteX, noteBase, '/______//______/  /  ', TIER_LAMP_GLOW, 0.78, true);
  }

  // 2. Steaming Coffee / Tea Mug
  const mugX = Math.round(cols * (isPhone ? 0.48 : 0.62)) + fgShiftX;
  const mugBase = deskTop + (isPhone ? 2 : 3);
  const mugRimR = mugBase - (isPhone ? 3 : 4);

  if (isPhone) {
    drawStr(buffers, cols, rows, mugX - 2, mugBase - 3, '.---.', TIER_LAMP_GLOW, 0.88, true);
    drawStr(
      buffers,
      cols,
      rows,
      mugX - 2,
      mugBase - 2,
      '|~ ~|)',
      isLight ? TIER_WOOD : TIER_BRIGHT,
      0.90,
      true
    );
    drawStr(buffers, cols, rows, mugX - 2, mugBase - 1, '|___|', TIER_LAMP_GLOW, 0.84, true);
    drawStr(buffers, cols, rows, mugX - 2, mugBase, '-----', TIER_WOOD, 0.72, true);
  } else {
    drawStr(buffers, cols, rows, mugX - 3, mugBase - 4, '.-----.', TIER_LAMP_GLOW, 0.88, true);
    drawStr(
      buffers,
      cols,
      rows,
      mugX - 3,
      mugBase - 3,
      '|~ ~ ~|)',
      isLight ? TIER_WOOD : TIER_BRIGHT,
      0.90,
      true
    );
    drawStr(buffers, cols, rows, mugX - 3, mugBase - 2, '|     ||', TIER_LAMP_GLOW, 0.86, true);
    drawStr(buffers, cols, rows, mugX - 3, mugBase - 1, '|_____|/', TIER_LAMP_GLOW, 0.82, true);
    drawStr(buffers, cols, rows, mugX - 3, mugBase, '[=====]', TIER_WOOD, 0.74, true);
  }

  // Animated rising steam wisps above mug
  const steamHeight = isPhone ? 8 : 13;
  const strands = isPhone ? 2 : 3;
  for (let s = 0; s < strands; s++) {
    const baseOffset = s === 0 ? -1 : s === 1 ? 1 : 0;
    const phase = s * 2.1;
    for (let h = 1; h <= steamHeight; h++) {
      const r = mugRimR - h;
      if (r < layout.winTop + 1 + fgShiftY) break;
      const frac = h / steamHeight;
      const drift = Math.sin(t * 2.2 - h * 0.62 + phase) * (0.7 + frac * 1.1);
      const c = Math.round(mugX + baseOffset + drift);
      const fade = 1 - frac;
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.0 - h * 0.8 + phase);
      if (fade * pulse < 0.16) continue;

      const slope = Math.cos(t * 2.2 - h * 0.62 + phase);
      const ch =
        frac > 0.72
          ? '.'
          : slope > 0.35
          ? ')'
          : slope < -0.35
          ? '('
          : '~';
      setCell(
        buffers,
        cols,
        rows,
        c,
        r,
        ch.charCodeAt(0),
        TIER_STEAM,
        clamp(0.32 + fade * 0.54 * pulse, 0, 0.95)
      );
    }
  }

  // 3. Articulated Architect Desk Lamp
  const lampX = Math.round(cols * (isPhone ? 0.78 : 0.80)) + fgShiftX;
  const lampBase = deskTop + (isPhone ? 2 : 3);
  const bulbX = lampX;
  const bulbR = lampBase - (isPhone ? 4 : 7);

  const coneEndR = lampBase + 1;
  for (let r = bulbR + 1; r < coneEndR; r++) {
    const dr = r - bulbR;
    const coneCx = bulbX - dr * 0.45;
    const halfW = 2 + dr * 0.55;
    for (let c = Math.floor(coneCx - halfW); c <= Math.ceil(coneCx + halfW); c++) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const idx = r * cols + c;
      if (buffers.charCodes[idx] !== 0 && buffers.charCodes[idx] !== CODE_SPACE) continue;

      const moteHash = fastHash(c + Math.floor(t * 0.35), r - Math.floor(t * 0.45));
      if (moteHash > (isLight ? 0.978 : 0.972)) {
        buffers.charCodes[idx] = '.'.charCodeAt(0);
        buffers.tiers[idx] = isLight ? TIER_WARM_WIN : TIER_BRIGHT;
        buffers.lumas[idx] = isLight ? 0.55 : 0.68;
      }
    }
  }

  if (isPhone) {
    drawStr(buffers, cols, rows, lampX - 2, lampBase - 6, '.===.', TIER_LAMP_GLOW, 0.86, true);
    drawStr(buffers, cols, rows, lampX - 3, lampBase - 5, '/#####\\', TIER_LAMP_GLOW, 0.90, true);
    drawStr(
      buffers,
      cols,
      rows,
      lampX - 3,
      lampBase - 4,
      '\\__*__/\\',
      isLight ? TIER_WARM_WIN : TIER_BRIGHT,
      0.96,
      true
    );
    drawStr(buffers, cols, rows, lampX + 3, lampBase - 3, '(o)', TIER_WOOD, 0.82, false);
    drawStr(buffers, cols, rows, lampX + 2, lampBase - 2, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX + 1, lampBase - 1, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX - 2, lampBase, '[=====]', TIER_WOOD, 0.84, true);
  } else {
    drawStr(buffers, cols, rows, lampX - 2, lampBase - 10, '.===.', TIER_LAMP_GLOW, 0.86, true);
    drawStr(buffers, cols, rows, lampX - 3, lampBase - 9, '/#####\\', TIER_LAMP_GLOW, 0.90, true);
    drawStr(buffers, cols, rows, lampX - 4, lampBase - 8, '/_______\\\\', TIER_LAMP_GLOW, 0.92, true);
    drawStr(
      buffers,
      cols,
      rows,
      lampX - 2,
      lampBase - 7,
      '( * )',
      isLight ? TIER_WARM_WIN : TIER_BRIGHT,
      0.98,
      false
    );
    setCell(buffers, cols, rows, lampX + 6, lampBase - 7, '\\'.charCodeAt(0), TIER_WOOD, 0.78);
    setCell(buffers, cols, rows, lampX + 7, lampBase - 6, '\\'.charCodeAt(0), TIER_WOOD, 0.78);
    drawStr(buffers, cols, rows, lampX + 7, lampBase - 5, '(o)', TIER_WOOD, 0.84, false);
    drawStr(buffers, cols, rows, lampX + 6, lampBase - 4, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX + 5, lampBase - 3, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX + 4, lampBase - 2, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX + 3, lampBase - 1, '//', TIER_WOOD, 0.78, false);
    drawStr(buffers, cols, rows, lampX, lampBase, '[=========]', TIER_WOOD, 0.84, true);
  }
}

export const cozyRoomScene: AsciiScene = {
  id: 'room',
  label: 'room',
  ramp: DEFAULT_ASCII_RAMP,

  getPalette(isLight: boolean): ScenePalette {
    return isLight ? LIGHT_PALETTE : DARK_PALETTE;
  },

  getWashTheme(isLight: boolean): SceneWashTheme {
    if (isLight) {
      return {
        troughColor: 'hsla(30, 38%, 36%, 0.65)',
        wakeColor: 'hsla(38, 48%, 88%, 0.78)',
        crestColor: 'hsla(44, 70%, 98%, 0.96)',
        crestChars: '*#%@~',
        wakeChars: '.:;-~=+*',
      };
    }
    return {
      troughColor: 'hsla(220, 32%, 38%, 0.52)',
      wakeColor: 'hsla(34, 65%, 70%, 0.74)',
      crestColor: 'hsla(42, 90%, 92%, 0.96)',
      crestChars: '*#%@~',
      wakeChars: '.:;-~=+*',
    };
  },

  getVeilStyle(): SceneVeilStyle {
    return {
      lightCenterRgba: 'hsla(40, 32%, 95%, 0.68)',
      lightMidRgba: 'hsla(40, 28%, 94%, 0.36)',
      darkCenterRgba: 'hsla(24, 24%, 8%, 0.42)',
      darkMidRgba: 'hsla(24, 20%, 8%, 0.16)',
    };
  },

  onResize(viewport: SceneViewport): void {
    const layout = computeLayout(viewport.cols, viewport.rows, viewport.isPhone);
    buildSkyline(layout);
  },

  renderBackdrop(ctx: CanvasRenderingContext2D, frame: SceneFrameContext): void {
    const { width, height, cols, rows, cellW, cellH, isPhone, isLight, pointerX, pointerY, reducedMotion } = frame;
    const layout = computeLayout(cols, rows, isPhone);

    const fgShiftX = reducedMotion ? 0 : pointerX * (isPhone ? 0.8 : 1.8);
    const fgShiftY = reducedMotion ? 0 : pointerY * (isPhone ? 0.4 : 0.9);

    // 1. Interior room wall ambiance
    const wallGrad = ctx.createLinearGradient(0, 0, width, height);
    if (isLight) {
      wallGrad.addColorStop(0.0, 'hsla(40, 30%, 89%, 0.90)');
      wallGrad.addColorStop(0.65, 'hsla(36, 28%, 86%, 0.90)');
      wallGrad.addColorStop(1.0, 'hsla(32, 30%, 82%, 0.92)');
    } else {
      wallGrad.addColorStop(0.0, 'hsla(222, 32%, 9%, 0.72)');
      wallGrad.addColorStop(0.65, 'hsla(24, 24%, 10%, 0.68)');
      wallGrad.addColorStop(1.0, 'hsla(24, 28%, 11%, 0.76)');
    }
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Panoramic window sky backdrop strictly bounded inside the window frame
    const winX = Math.max(0, (layout.winLeft + 0.5 + fgShiftX) * cellW);
    const winY = Math.max(0, (layout.winTop + 0.5 + fgShiftY) * cellH);
    const winW = Math.max(10, (layout.winW - 1) * cellW);
    const winH = Math.max(10, (layout.winH - 0.5) * cellH);

    const skyGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
    if (isLight) {
      skyGrad.addColorStop(0.0, 'hsla(202, 58%, 74%, 0.88)');
      skyGrad.addColorStop(0.58, 'hsla(194, 46%, 83%, 0.88)');
      skyGrad.addColorStop(1.0, 'hsla(38, 62%, 85%, 0.90)');
    } else {
      skyGrad.addColorStop(0.0, 'hsla(224, 54%, 10%, 0.78)');
      skyGrad.addColorStop(0.62, 'hsla(218, 44%, 15%, 0.74)');
      skyGrad.addColorStop(1.0, 'hsla(28, 60%, 20%, 0.66)');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(winX, winY, winW, winH);

    // 3. Soft sunlit diagonal shafts in Light Mode (clipped strictly below window top)
    if (isLight) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(winX, winY, width - winX, height - winY);
      ctx.clip();
      const beamGrad = ctx.createLinearGradient(winX + winW * 0.9, winY, winX + winW * 0.2, height);
      beamGrad.addColorStop(0.0, 'hsla(44, 82%, 94%, 0.24)');
      beamGrad.addColorStop(0.6, 'hsla(42, 74%, 92%, 0.12)');
      beamGrad.addColorStop(1.0, 'hsla(42, 74%, 92%, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(winX + winW * 0.55, winY);
      ctx.lineTo(winX + winW, winY);
      ctx.lineTo(winX + winW * 0.65, height);
      ctx.lineTo(winX + winW * 0.15, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Desk surface tint
    const deskTopPx = Math.max(0, (layout.deskTop + fgShiftY) * cellH);
    const deskGrad = ctx.createLinearGradient(0, deskTopPx, 0, height);
    if (isLight) {
      deskGrad.addColorStop(0.0, 'hsla(30, 34%, 76%, 0.60)');
      deskGrad.addColorStop(1.0, 'hsla(26, 36%, 68%, 0.72)');
    } else {
      deskGrad.addColorStop(0.0, 'hsla(25, 36%, 11%, 0.62)');
      deskGrad.addColorStop(1.0, 'hsla(22, 34%, 8%, 0.76)');
    }
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, deskTopPx, width, height - deskTopPx);

    // 5. Warm radial glow from the desk lamp
    const bulbX = (Math.round(cols * (isPhone ? 0.78 : 0.80)) + fgShiftX) * cellW;
    const bulbY = (layout.deskTop + (isPhone ? -2 : -4) + fgShiftY) * cellH;
    const glowRadius = Math.max(110, width * (isPhone ? 0.42 : 0.26));
    const lampGlow = ctx.createRadialGradient(bulbX, bulbY, glowRadius * 0.05, bulbX, bulbY, glowRadius);
    if (isLight) {
      lampGlow.addColorStop(0.0, 'hsla(40, 88%, 84%, 0.22)');
      lampGlow.addColorStop(0.55, 'hsla(38, 78%, 80%, 0.08)');
      lampGlow.addColorStop(1.0, 'hsla(38, 78%, 80%, 0.0)');
    } else {
      lampGlow.addColorStop(0.0, 'hsla(36, 94%, 60%, 0.26)');
      lampGlow.addColorStop(0.48, 'hsla(32, 86%, 48%, 0.11)');
      lampGlow.addColorStop(1.0, 'hsla(32, 86%, 48%, 0.0)');
    }
    ctx.fillStyle = lampGlow;
    ctx.fillRect(
      Math.max(0, bulbX - glowRadius),
      Math.max(0, bulbY - glowRadius),
      glowRadius * 2,
      glowRadius * 2
    );
  },

  renderCells(frame: SceneFrameContext, buffers: SceneCellBuffers): void {
    const { cols, rows, isPhone, pointerX, pointerY, reducedMotion } = frame;
    const layout = computeLayout(cols, rows, isPhone);
    const skyline = buildSkyline(layout);

    const fgShiftX = reducedMotion ? 0 : Math.round(pointerX * (isPhone ? 0.8 : 1.8));
    const fgShiftY = reducedMotion ? 0 : Math.round(pointerY * (isPhone ? 0.4 : 0.9));
    const skyShiftX = reducedMotion ? 0 : Math.round(-pointerX * (isPhone ? 1.0 : 2.6));
    const skyShiftY = reducedMotion ? 0 : Math.round(-pointerY * (isPhone ? 0.4 : 1.0));

    drawSkyAndCity(frame, buffers, layout, skyline, fgShiftX, fgShiftY, skyShiftX, skyShiftY);
    drawWindowFrameAndSill(frame, buffers, layout, fgShiftX, fgShiftY);
    drawLeftInteriorWall(frame, buffers, layout, fgShiftX, fgShiftY);
    drawCurtains(frame, buffers, layout, fgShiftX, fgShiftY);
    drawPottedPlantAndCandle(frame, buffers, layout, fgShiftX, fgShiftY);
    drawDeskSurface(frame, buffers, layout, fgShiftX, fgShiftY);
    drawDeskObjects(frame, buffers, layout, fgShiftX, fgShiftY);
  },
};
