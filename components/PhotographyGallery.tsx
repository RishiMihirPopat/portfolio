'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { Photo } from '@/lib/data';

export type GalleryPhoto = Photo & {
  width?: number;
  height?: number;
};

type GalleryViewMode = 'spread' | 'grid';

interface PhotographyGalleryProps {
  photos: GalleryPhoto[];
  onSelectPhoto: (photo: GalleryPhoto) => void;
}

const CALM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LAYOUT_SPRING = {
  type: 'spring' as const,
  stiffness: 240,
  damping: 28,
  mass: 0.9,
};

/**
 * Editorial 12-column placement rhythm for "spread" mode.
 * Each frame occupies its own space across the full viewport with intentional
 * breathing room so the ASCII background flows naturally between individual prints.
 */
const SPREAD_SLOTS = [
  'md:col-span-6 lg:col-start-1 lg:col-span-5 lg:mt-2',
  'md:col-span-5 md:col-start-8 lg:col-start-8 lg:col-span-5 lg:mt-24',
  'md:col-span-5 md:col-start-2 lg:col-start-3 lg:col-span-4 lg:mt-10',
  'md:col-span-6 md:col-start-7 lg:col-start-8 lg:col-span-4 lg:mt-28',
  'md:col-span-6 md:col-start-1 lg:col-start-2 lg:col-span-5 lg:mt-8',
  'md:col-span-5 md:col-start-8 lg:col-start-8 lg:col-span-5 lg:mt-20',
] as const;

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

interface GalleryCardProps {
  photo: GalleryPhoto;
  index: number;
  viewMode: GalleryViewMode;
  isDimmed: boolean;
  isHovered: boolean;
  onHoverChange: (id: string | null) => void;
  onSelectPhoto: (photo: GalleryPhoto) => void;
}

function GalleryCard({
  photo,
  index,
  viewMode,
  isDimmed,
  isHovered,
  onHoverChange,
  onSelectPhoto,
}: GalleryCardProps) {
  const cardRef = useRef<HTMLLIElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });

  // Gentle alternating vertical drift in spread mode so frames feel suspended in space
  const parallaxRange = index % 2 === 0 ? [-14, 14] : [18, -18];
  const rawParallaxY = useTransform(scrollYProgress, [0, 1], parallaxRange);
  const parallaxEnabled = viewMode === 'spread' && !prefersReducedMotion;

  const width =
    typeof photo.width === 'number' && photo.width > 0 ? photo.width : undefined;
  const height =
    typeof photo.height === 'number' && photo.height > 0 ? photo.height : undefined;
  const hasDimensions = width !== undefined && height !== undefined;

  const isLoaded = loadedUrl === photo.url;
  const isUnavailable = !photo.url || failedUrl === photo.url;

  const paddedIndex = String(index + 1).padStart(2, '0');
  const formattedDate = formatShortDate(photo.createdAt);
  const metaLabel = formattedDate ? `${paddedIndex} · ${formattedDate}` : paddedIndex;
  const title = photo.title || 'Untitled';

  const slotClass =
    viewMode === 'spread'
      ? SPREAD_SLOTS[index % SPREAD_SLOTS.length]
      : 'col-span-1';

  return (
    <motion.li
      ref={cardRef}
      layout="position"
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        layout: LAYOUT_SPRING,
        opacity: { duration: 0.55, ease: CALM_EASE, delay: Math.min(index * 0.06, 0.24) },
        y: { duration: 0.65, ease: CALM_EASE, delay: Math.min(index * 0.06, 0.24) },
        scale: { duration: 0.65, ease: CALM_EASE, delay: Math.min(index * 0.06, 0.24) },
      }}
      style={parallaxEnabled ? { y: rawParallaxY } : undefined}
      className={slotClass}
    >
      <motion.article
        data-ascii-panel="true"
        animate={{
          opacity: isDimmed ? 0.58 : 1,
          y: isHovered && !prefersReducedMotion ? -4 : 0,
        }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        transition={{ duration: 0.26, ease: CALM_EASE }}
        onMouseEnter={() => onHoverChange(photo.id)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onHoverChange(photo.id)}
        onBlur={() => onHoverChange(null)}
        className="group relative border border-line bg-surface/80 backdrop-blur-[2px] hover:border-ink/55 transition-colors duration-300 rounded-[2px] overflow-hidden has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-ink has-[button:focus-visible]:outline-offset-2"
      >
        <div
          className={`relative overflow-hidden bg-surface/90${
            !hasDimensions && !isLoaded && !isUnavailable ? ' min-h-[180px]' : ''
          }`}
        >
          {isUnavailable ? (
            <div
              className="flex min-h-[180px] w-full items-center justify-center px-3 py-8 text-center font-mono text-xs text-ink-muted"
              style={hasDimensions ? { aspectRatio: `${width} / ${height}` } : undefined}
            >
              [ image unavailable ]
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo.url}
              alt={title}
              width={hasDimensions ? width : undefined}
              height={hasDimensions ? height : undefined}
              style={hasDimensions ? { aspectRatio: `${width} / ${height}` } : undefined}
              loading={index >= 2 ? 'lazy' : undefined}
              decoding={index >= 2 ? 'async' : undefined}
              fetchPriority={index === 0 ? 'high' : undefined}
              onLoad={() => setLoadedUrl(photo.url)}
              onError={() => setFailedUrl(photo.url)}
              className={`w-full block motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.03] ${
                viewMode === 'grid'
                  ? 'aspect-[4/3] object-cover'
                  : 'h-auto max-h-[70vh] object-cover'
              }`}
            />
          )}
        </div>

        <div className="border-t border-line px-3.5 py-3 space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-xs sm:text-[13px] font-normal text-ink min-w-0 truncate">
              <button
                type="button"
                onClick={() => onSelectPhoto(photo)}
                className="block w-full truncate text-left after:content-[''] after:absolute after:inset-0 focus-visible:outline-none cursor-pointer"
              >
                {title}
                <span className="sr-only"> — open preview</span>
              </button>
            </h2>
            <span className="font-mono text-[11px] text-ink-muted shrink-0">
              {metaLabel}
            </span>
          </div>
          {photo.description && viewMode === 'spread' && (
            <p className="font-sans text-xs text-ink-muted leading-relaxed line-clamp-2 transition-colors duration-200 group-hover:text-ink/85">
              {photo.description}
            </p>
          )}
        </div>
      </motion.article>
    </motion.li>
  );
}

export function PhotographyGallery({ photos, onSelectPhoto }: PhotographyGalleryProps) {
  const [viewMode, setViewMode] = useState<GalleryViewMode>('spread');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Re-measure ASCII clear halos after layout spring settles
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 360);
    return () => window.clearTimeout(timer);
  }, [viewMode, photos.length]);

  const countLabel = `${String(photos.length).padStart(2, '0')} ${
    photos.length === 1 ? 'frame' : 'frames'
  }`;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="photography-gallery">
        <div className="space-y-8 sm:space-y-12 w-full">
          {/* Top metadata & view mode bar — slim clear halo so ASCII flows below */}
          <div
            data-ascii-panel="true"
            className="border-t border-line pt-3 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-baseline gap-3">
              <p className="font-sans text-xs sm:text-sm text-ink-muted">
                Selected frames &amp; field studies.
              </p>
              <span className="font-mono text-xs text-ink-muted/80 shrink-0">
                {countLabel}
              </span>
            </div>

            {photos.length > 1 && (
              <div
                role="group"
                aria-label="Gallery layout"
                className="inline-flex items-center gap-4 font-mono text-xs"
              >
                {(['spread', 'grid'] as const).map((mode) => {
                  const isActive = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      aria-pressed={isActive}
                      className={`relative pb-1 transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'text-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {mode}
                      {isActive && (
                        <motion.span
                          layoutId="photo-view-underline"
                          transition={LAYOUT_SPRING}
                          className="absolute left-0 right-0 bottom-0 h-px bg-ink"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {photos.length === 0 ? (
            <p
              data-ascii-panel="true"
              className="font-sans text-sm text-ink-muted py-6 w-fit"
            >
              No photographs archived yet.
            </p>
          ) : (
            <ul
              role="list"
              className={
                viewMode === 'spread'
                  ? 'grid grid-cols-1 md:grid-cols-12 gap-y-12 md:gap-x-8 lg:gap-x-10 lg:gap-y-16 pb-12 w-full items-start'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pb-8 w-full'
              }
            >
              {photos.map((photo, index) => (
                <GalleryCard
                  key={photo.id}
                  photo={photo}
                  index={index}
                  viewMode={viewMode}
                  isHovered={hoveredId === photo.id}
                  isDimmed={hoveredId !== null && hoveredId !== photo.id}
                  onHoverChange={setHoveredId}
                  onSelectPhoto={onSelectPhoto}
                />
              ))}
            </ul>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
