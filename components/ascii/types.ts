export type AnimatedAsciiSceneId = 'swell' | 'contour' | 'caustics';
export type AsciiSceneId = AnimatedAsciiSceneId | 'still';

export const ASCII_SCENE_IDS: readonly AsciiSceneId[] = [
  'swell',
  'contour',
  'caustics',
  'still',
] as const;

export const DEFAULT_ASCII_SCENE: AsciiSceneId = 'swell';
export const ASCII_SCENE_STORAGE_KEY = 'portfolio_ascii_scene';
export const ASCII_SCENE_CHANGE_EVENT = 'ascii-scene-change';

const LEGACY_SCENE_MAP: Record<string, AsciiSceneId> = {
  beach: 'swell',
  city: 'contour',
  room: 'caustics',
};

export function normalizeAsciiSceneId(
  value: string | null | undefined
): AsciiSceneId {
  if (!value) return DEFAULT_ASCII_SCENE;
  if (
    value === 'swell' ||
    value === 'contour' ||
    value === 'caustics' ||
    value === 'still'
  ) {
    return value;
  }
  return LEGACY_SCENE_MAP[value] ?? DEFAULT_ASCII_SCENE;
}
