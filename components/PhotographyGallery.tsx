'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
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
  onSelectPhoto?: (photo: GalleryPhoto) => void;
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

function formatFullDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(Math.round(width), Math.round(height)) || 1;
  const rw = Math.round(width / d);
  const rh = Math.round(height / d);
  if (rw <= 20 && rh <= 20) return `${rw}:${rh}`;
  return `${(width / height).toFixed(2)}:1`;
}

interface GalleryCardProps {
  photo: GalleryPhoto;
  index: number;
  total: number;
  viewMode: GalleryViewMode;
  isExpanded: boolean;
  isDimmed: boolean;
  isHovered: boolean;
  onHoverChange: (id: string | null) => void;
  onToggleExpand: (photo: GalleryPhoto) => void;
}

function GalleryCard({
  photo,
  index,
  total,
  viewMode,
  isExpanded,
  isDimmed,
  isHovered,
  onHoverChange,
  onToggleExpand,
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
  const paddedTotal = String(total).padStart(2, '0');
  const formattedDate = formatShortDate(photo.createdAt);
  const fullDate = formatFullDate(photo.createdAt);
  const metaLabel = formattedDate ? `${paddedIndex} · ${formattedDate}` : paddedIndex;
  const title = photo.title || 'Untitled';
  const detailsId = `photo-details-${photo.id}`;

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
        layout="position"
        animate={{
          opacity: isDimmed ? 0.58 : 1,
          y: (isHovered || isExpanded) && !prefersReducedMotion ? -4 : 0,
        }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.992 }}
        transition={{
          layout: LAYOUT_SPRING,
          duration: 0.26,
          ease: CALM_EASE,
        }}
        onMouseEnter={() => onHoverChange(photo.id)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onHoverChange(photo.id)}
        onBlur={() => onHoverChange(null)}
        className={`group relative border bg-surface/85 backdrop-blur-[2px] transition-colors duration-300 rounded-[2px] overflow-hidden has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-ink has-[button:focus-visible]:outline-offset-2 ${
          isExpanded
            ? 'border-ink/65'
            : 'border-line hover:border-ink/55'
        }`}
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
              className={`w-full block motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isExpanded
                  ? 'motion-safe:scale-[1.015]'
                  : 'motion-safe:group-hover:scale-[1.03]'
              } ${
                viewMode === 'grid' && !isExpanded
                  ? 'aspect-[4/3] object-cover'
                  : 'h-auto max-h-[75vh] object-cover'
              }`}
            />
          )}
        </div>

        <div className="border-t border-line px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-xs sm:text-[13px] font-normal text-ink min-w-0 truncate">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                onClick={() => onToggleExpand(photo)}
                className="block w-full truncate text-left after:content-[''] after:absolute after:inset-0 focus-visible:outline-none cursor-pointer"
              >
                {title}
                <span className="sr-only">
                  {isExpanded ? ' — hide details' : ' — show details'}
                </span>
              </button>
            </h2>
            <div className="flex items-baseline gap-2.5 shrink-0 font-mono text-[11px] text-ink-muted">
              <span>{metaLabel}</span>
              <span
                aria-hidden="true"
                className="text-ink/70 transition-colors duration-200 group-hover:text-ink"
              >
                {isExpanded ? '−' : '+'}
              </span>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                id={detailsId}
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: CALM_EASE }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 border-t border-line/80 space-y-3">
                  {photo.description && (
                    <p className="font-sans text-xs sm:text-sm text-ink/90 leading-relaxed">
                      {photo.description}
                    </p>
                  )}

                  <dl className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2 font-mono text-[11px]">
                    <div className="space-y-0.5">
                      <dt className="text-ink-muted/75">frame</dt>
                      <dd className="text-ink">
                        {paddedIndex} / {paddedTotal}
                      </dd>
                    </div>
                    {fullDate && (
                      <div className="space-y-0.5">
                        <dt className="text-ink-muted/75">captured</dt>
                        <dd className="text-ink">{fullDate}</dd>
                      </div>
                    )}
                    {hasDimensions && width && height && (
                      <div className="space-y-0.5">
                        <dt className="text-ink-muted/75">format</dt>
                        <dd className="text-ink">
                          {width} × {height} · {formatAspectRatio(width, height)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.article>
    </motion.li>
  );
}

export function PhotographyGallery({ photos, onSelectPhoto }: PhotographyGalleryProps) {
  const [viewMode, setViewMode] = useState<GalleryViewMode>('spread');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collapse expanded details on Escape
  useEffect(() => {
    if (!expandedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedId]);

  // Re-measure ASCII clear halos after layout/expand transitions settle
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 360);
    return () => window.clearTimeout(timer);
  }, [viewMode, expandedId, photos.length]);

  const handleToggleExpand = (photo: GalleryPhoto) => {
    setExpandedId((prev) => (prev === photo.id ? null : photo.id));
    onSelectPhoto?.(photo);
  };

  const countLabel = `${String(photos.length).padStart(2, '0')} ${
    photos.length === 1 ? 'frame' : 'frames'
  }`;

  const activeFocusId = hoveredId ?? expandedId;

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
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pb-8 w-full items-start'
              }
            >
              {photos.map((photo, index) => {
                const isExpanded = expandedId === photo.id;
                const isHovered = hoveredId === photo.id;
                const isDimmed =
                  activeFocusId !== null &&
                  activeFocusId !== photo.id &&
                  !isExpanded;

                return (
                  <GalleryCard
                    key={photo.id}
                    photo={photo}
                    index={index}
                    total={photos.length}
                    viewMode={viewMode}
                    isExpanded={isExpanded}
                    isHovered={isHovered}
                    isDimmed={isDimmed}
                    onHoverChange={setHoveredId}
                    onToggleExpand={handleToggleExpand}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
