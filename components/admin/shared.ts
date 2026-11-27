import type { Variants } from 'motion/react';
import type { PhotoExifMetadata } from '@/lib/exif';
import { CALM_EASE, WAVE_EXIT_EASE } from '@/components/CollapsibleLog';

export const DEFAULT_SKILL_CATEGORIES = [
  'Languages & Stats',
  'Methods & Modeling',
  'Libraries & Tools',
];

export type AdminTab =
  | 'blog'
  | 'manage-blog'
  | 'photo'
  | 'manage-photo'
  | 'collections'
  | 'projects'
  | 'skills';

export const TAB_ORDER: AdminTab[] = [
  'blog',
  'manage-blog',
  'photo',
  'manage-photo',
  'collections',
  'projects',
  'skills',
];

export const TAB_PANEL_VARIANTS: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir * 12,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.22,
      ease: CALM_EASE,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -12,
    transition: {
      duration: 0.15,
      ease: WAVE_EXIT_EASE,
    },
  }),
};

export interface AuthUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface PendingDeleteTarget {
  kind: 'post' | 'photo' | 'collection';
  id: string;
  title: string;
}

export interface StatusFeedback {
  kind: 'success' | 'error';
  text: string;
}

export interface PendingPhoto extends PhotoExifMetadata {
  id: string;
  url: string;
  title: string;
  description: string;
  width: number;
  height: number;
}

export const PHOTO_EXIF_FIELDS = [
  ['collection', 'Collection', 'Coast'],
  ['camera', 'Camera', 'Fujifilm X100V'],
  ['lens', 'Lens', '23mm f/2'],
  ['location', 'Location', 'Manipal, IN'],
  ['focalLength', 'Focal', '35mm'],
  ['aperture', 'Aperture', 'f/2.8'],
  ['shutterSpeed', 'Shutter', '1/500s'],
  ['iso', 'ISO', 'ISO 400'],
] as const;

export const INPUT_CLASS =
  'w-full bg-surface/90 border border-line-control px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-ink placeholder:text-ink-muted focus:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 transition-colors rounded-[2px]';
export const LABEL_CLASS = 'block font-mono text-xs text-ink-muted';
export const PRIMARY_BTN_CLASS =
  'font-mono text-xs px-4 py-2.5 min-h-[44px] bg-ink text-bg border border-ink hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]';
export const SECONDARY_BTN_CLASS =
  'font-mono text-xs px-3.5 py-2 min-h-[44px] bg-surface/85 text-ink border border-line-control hover:border-ink transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]';
export const INLINE_ACTION_CLASS =
  'font-mono text-xs text-ink-nav hover:text-ink underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';
export const DANGER_INLINE_CLASS =
  'font-mono text-xs text-danger hover:underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';
