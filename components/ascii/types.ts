export type AsciiSceneId = 'beach' | 'city' | 'room';

export const ASCII_SCENE_IDS: readonly AsciiSceneId[] = ['beach', 'city', 'room'] as const;
export const DEFAULT_ASCII_SCENE: AsciiSceneId = 'beach';
export const ASCII_SCENE_STORAGE_KEY = 'portfolio-ascii-scene';
export const ASCII_SCENE_CHANGE_EVENT = 'ascii-scene-change';

export const MAX_SCENE_TIERS = 12;
export const DEFAULT_ASCII_RAMP = ' .,:;-=+*#%@';

export type ScenePalette = readonly string[];

export interface SceneViewport {
  /** Viewport CSS pixel width */
  width: number;
  /** Viewport CSS pixel height */
  height: number;
  /** Number of character columns in the ASCII grid */
  cols: number;
  /** Number of character rows in the ASCII grid */
  rows: number;
  /** Width of one monospace cell in CSS pixels */
  cellW: number;
  /** Height of one monospace cell in CSS pixels */
  cellH: number;
  /** True when viewport width < 760px */
  isPhone: boolean;
  /** True when light theme is active */
  isLight: boolean;
}

export interface SceneFrameContext extends SceneViewport {
  /** Elapsed animation time in seconds (frozen when reducedMotion is true) */
  t: number;
  /** Frame delta time in seconds (0 when reducedMotion is true) */
  dt: number;
  /** Smoothed horizontal pointer offset normalized to [-1, 1] (0 at center or idle) */
  pointerX: number;
  /** Smoothed vertical pointer offset normalized to [-1, 1] (0 at center or idle) */
  pointerY: number;
  /** True when prefers-reduced-motion: reduce is active */
  reducedMotion: boolean;
  /** True when current route is '/' */
  isHome: boolean;
  /** True while a route-transition wash is sweeping across the viewport */
  washActive: boolean;
  /** Normalized progress [0, 1] of the active route-transition wash */
  washProgress: number;
  /** Per-column wash crest row index during active route wash (length === cols), or null */
  washCrestRows: Float32Array | null;
}

export interface SceneCellBuffers {
  /**
   * Per-cell normalized luminance in [0, 1], indexed as `r * cols + c`.
   * Used to pick a ramp glyph when `charCodes[idx] === 0`.
   */
  lumas: Float32Array;
  /**
   * Per-cell color tier index in `[0, palette.length - 1]`, indexed as `r * cols + c`.
   */
  tiers: Uint8Array;
  /**
   * Optional per-cell explicit UTF-16 character code (e.g. `'|'.charCodeAt(0)`),
   * indexed as `r * cols + c`. Leave `0` to render from the luminance ramp.
   * Use `32` (`' '.charCodeAt(0)`) or `lumas[idx] = 0` for an empty cell.
   */
  charCodes: Uint16Array;
}

export interface SceneWashTheme {
  /** Color for the leading swell/trough of the route-transition wash */
  troughColor: string;
  /** Color for the trailing mist/wake of the route-transition wash */
  wakeColor: string;
  /** Color for the bright crest lip of the route-transition wash */
  crestColor: string;
  /** Optional custom characters for the bright crest lip (default: '*#%@') */
  crestChars?: string;
  /** Optional custom characters for the trailing wake (default: '.:;-~=+*') */
  wakeChars?: string;
}

export interface SceneVeilStyle {
  /**
   * Optional light-mode radial veil HSL/RGB color prefix or solid hsla string stops.
   * When provided as `hsl(...)` or `rgb(...)` or `h, s%, l%` tuple, engine uses its own
   * feathered radial veil; if omitted, engine uses a neutral warm paper veil in light mode.
   */
  lightCenterRgba?: string;
  lightMidRgba?: string;
  /** Optional dark-mode subtle radial veil behind foreground text panel */
  darkCenterRgba?: string;
  darkMidRgba?: string;
}

export interface AsciiScene {
  /** Unique scene identifier */
  readonly id: AsciiSceneId;
  /** Short lowercase display label for UI toggles */
  readonly label: string;
  /** Optional custom luminance ramp (defaults to DEFAULT_ASCII_RAMP) */
  readonly ramp?: string;
  /**
   * Return 1–12 CSS color strings for color tiers `0..N-1` in the given theme.
   * Typically 8–12 tiers.
   */
  getPalette(isLight: boolean): ScenePalette;
  /** Optional per-scene wash colors for route transitions */
  getWashTheme?(isLight: boolean): SceneWashTheme;
  /** Optional per-scene readability veil tint behind the active content column */
  getVeilStyle?(isLight: boolean): SceneVeilStyle;
  /**
   * Called whenever viewport dimensions or grid size change (and before first render).
   */
  onResize?(viewport: SceneViewport): void;
  /**
   * Draw the scene's backdrop gradient / atmosphere onto the canvas before ASCII glyphs are rendered.
   */
  renderBackdrop(ctx: CanvasRenderingContext2D, frame: SceneFrameContext): void;
  /**
   * Populate `buffers.lumas`, `buffers.tiers`, and optionally `buffers.charCodes` for every cell.
   * Buffers are zeroed by the engine before each call.
   */
  renderCells(frame: SceneFrameContext, buffers: SceneCellBuffers): void;
}
