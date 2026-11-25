'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'motion/react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Photo } from '@/lib/data';

export type GalleryPhoto = Photo & {
  width?: number;
  height?: number;
};

type GalleryDensity = 'gallery' | 'contact';
type GallerySort = 'newest' | 'oldest';

interface PhotographyGalleryProps {
  photos: GalleryPhoto[];
  onSelectPhoto?: (photo: GalleryPhoto) => void;
}

const CALM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const TAB_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
};

const ALL_COLLECTION = '__all__';
const UNCATEGORIZED_COLLECTION = '__uncategorized__';

function getPhotoTimestamp(photo: GalleryPhoto): number {
  const raw = photo.takenAt || photo.createdAt;
  if (!raw) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

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

function formatFrameNumber(index: number, total: number): string {
  const digits = total >= 100 ? 3 : 2;
  return String(index + 1).padStart(digits, '0');
}

interface GalleryTileProps {
  photo: GalleryPhoto;
  index: number;
  total: number;
  density: GalleryDensity;
  isSelected: boolean;
  onSelect: (photo: GalleryPhoto) => void;
}

function GalleryTile({
  photo,
  index,
  total,
  density,
  isSelected,
  onSelect,
}: GalleryTileProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const isUnavailable = !photo.url || failedUrl === photo.url;
  const title = photo.title || 'Untitled';
  const frameNum = formatFrameNumber(index, total);
  const dateLabel = formatShortDate(photo.takenAt || photo.createdAt);
  const subline = [photo.camera, photo.collection || dateLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        ease: CALM_EASE,
        delay: Math.min((index % 24) * 0.02, 0.24),
      }}
      className="min-w-0"
    >
      <button
        type="button"
        data-ascii-panel="true"
        onClick={() => onSelect(photo)}
        aria-pressed={isSelected}
        className={`group relative block w-full text-left border bg-surface/85 rounded-[2px] overflow-hidden transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 cursor-pointer ${
          isSelected
            ? 'border-ink ring-1 ring-ink/50'
            : 'border-line hover:border-ink/55'
        }`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface/95">
          {isUnavailable ? (
            <div className="flex h-full w-full items-center justify-center px-2 text-center font-mono text-[11px] text-ink-muted">
              [ unavailable ]
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo.url}
              alt={title}
              loading={index >= 6 ? 'lazy' : undefined}
              decoding={index >= 6 ? 'async' : undefined}
              fetchPriority={index === 0 ? 'high' : undefined}
              onError={() => setFailedUrl(photo.url)}
              className="h-full w-full object-cover block motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.035]"
            />
          )}

          {density === 'contact' && (
            <>
              <span className="pointer-events-none absolute top-1.5 left-1.5 px-1.5 py-0.5 font-mono text-[10px] leading-none bg-bg/80 text-ink/90 rounded-[2px]">
                {frameNum}
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-bg/90 via-bg/55 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 font-mono text-[11px] text-ink truncate">
                {title}
              </span>
            </>
          )}
        </div>

        {density === 'gallery' && (
          <div className="border-t border-line px-3 py-2.5 space-y-0.5">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="font-mono text-xs sm:text-[13px] text-ink truncate">
                {title}
              </span>
              <span className="font-mono text-[11px] text-ink-muted shrink-0">
                {frameNum}
              </span>
            </div>
            {subline && (
              <p className="font-mono text-[11px] text-ink-muted/85 truncate">
                {subline}
              </p>
            )}
          </div>
        )}
      </button>
    </motion.li>
  );
}

export function PhotographyGallery({ photos, onSelectPhoto }: PhotographyGalleryProps) {
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLElement>(null);

  const [activeCollection, setActiveCollection] = useState<string>(ALL_COLLECTION);
  const [density, setDensity] = useState<GalleryDensity>('gallery');
  const [sortOrder, setSortOrder] = useState<GallerySort>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<number>(1);
  const [visibleLimit, setVisibleLimit] = useState<number>(24);
  const [stageFailedUrl, setStageFailedUrl] = useState<string | null>(null);

  const pageSize = density === 'contact' ? 48 : 24;

  // Build collection tabs with counts
  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorizedCount = 0;

    for (const photo of photos) {
      const col = photo.collection?.trim();
      if (col) {
        counts.set(col, (counts.get(col) || 0) + 1);
      } else {
        uncategorizedCount += 1;
      }
    }

    const named = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ id: name, label: name, count }));

    const tabs = [{ id: ALL_COLLECTION, label: 'All', count: photos.length }, ...named];
    if (named.length > 0 && uncategorizedCount > 0) {
      tabs.push({
        id: UNCATEGORIZED_COLLECTION,
        label: 'Uncategorized',
        count: uncategorizedCount,
      });
    }
    return tabs;
  }, [photos]);

  // Ensure activeCollection stays valid if photos update
  const resolvedCollection = useMemo(() => {
    if (activeCollection === ALL_COLLECTION) return ALL_COLLECTION;
    return collections.some((c) => c.id === activeCollection)
      ? activeCollection
      : ALL_COLLECTION;
  }, [activeCollection, collections]);

  // Filter & sort photos
  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = photos.filter((photo) => {
      const col = photo.collection?.trim() || '';
      if (resolvedCollection === UNCATEGORIZED_COLLECTION) {
        if (col) return false;
      } else if (resolvedCollection !== ALL_COLLECTION) {
        if (col !== resolvedCollection) return false;
      }

      if (!q) return true;
      const haystack = [
        photo.title,
        photo.description,
        photo.camera,
        photo.lens,
        photo.location,
        photo.collection,
        photo.focalLength,
        photo.aperture,
        photo.iso,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    list.sort((a, b) => {
      const ta = getPhotoTimestamp(a);
      const tb = getPhotoTimestamp(b);
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    return list;
  }, [photos, resolvedCollection, searchQuery, sortOrder]);

  const visiblePhotos = useMemo(
    () => filteredPhotos.slice(0, visibleLimit),
    [filteredPhotos, visibleLimit]
  );

  const selectedIndex = useMemo(
    () => (selectedId ? filteredPhotos.findIndex((p) => p.id === selectedId) : -1),
    [filteredPhotos, selectedId]
  );

  const selectedPhoto = selectedIndex >= 0 ? filteredPhotos[selectedIndex] : null;

  const handleSelectCollection = (colId: string) => {
    setActiveCollection(colId);
    setVisibleLimit(pageSize);
    setSelectedId(null);
  };

  const handleChangeDensity = (next: GalleryDensity) => {
    setDensity(next);
    setVisibleLimit((prev) => Math.max(prev, next === 'contact' ? 48 : 24));
  };

  const handleSelectTile = useCallback(
    (photo: GalleryPhoto) => {
      if (selectedId === photo.id) {
        setSelectedId(null);
        return;
      }
      setNavDirection(1);
      setSelectedId(photo.id);
      onSelectPhoto?.(photo);

      // Smoothly bring the inline inspection stage into view if user scrolled down
      requestAnimationFrame(() => {
        stageRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
        });
      });
    },
    [selectedId, onSelectPhoto, prefersReducedMotion]
  );

  const handleStep = useCallback(
    (delta: number) => {
      if (filteredPhotos.length <= 1 || selectedIndex < 0) return;
      const nextIdx =
        (selectedIndex + delta + filteredPhotos.length) % filteredPhotos.length;
      setNavDirection(delta);
      const nextPhoto = filteredPhotos[nextIdx];
      setSelectedId(nextPhoto.id);
      if (nextIdx >= visibleLimit) {
        setVisibleLimit(nextIdx + pageSize);
      }
    },
    [filteredPhotos, selectedIndex, visibleLimit, pageSize]
  );

  // Keyboard navigation while inline inspection stage is open
  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStep(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStep(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPhoto, handleStep]);

  // Re-sync ASCII clear halos when stage opens/closes or layout changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 340);
    return () => window.clearTimeout(timer);
  }, [selectedId, resolvedCollection, density, visiblePhotos.length]);

  const remainingCount = Math.max(0, filteredPhotos.length - visiblePhotos.length);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="photography-archive">
        <div className="space-y-5 w-full pb-10">
          {/* Archive Controls: Collections + Search + Density + Sort */}
          <div
            data-ascii-panel="true"
            className="border-t border-b border-line py-3 space-y-2.5"
          >
            {/* Row 1: Collection Tabs + Frame Count */}
            <div className="flex items-baseline justify-between gap-4">
              <div
                role="tablist"
                aria-label="Photo collections"
                className="flex items-center gap-5 overflow-x-auto pb-1 -mb-1"
              >
                {collections.map((col) => {
                  const isActive = resolvedCollection === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSelectCollection(col.id)}
                      className={`relative pb-1.5 font-mono text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer flex items-baseline gap-1.5 ${
                        isActive
                          ? 'text-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <span>{col.label}</span>
                      <span className="text-[10px] text-ink-muted/80">
                        {String(col.count).padStart(2, '0')}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="photo-collection-underline"
                          transition={TAB_SPRING}
                          className="absolute left-0 right-0 bottom-0 h-px bg-ink"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <span className="hidden sm:inline font-mono text-[11px] text-ink-muted shrink-0">
                {filteredPhotos.length === photos.length
                  ? `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'frame' : 'frames'}`
                  : `${filteredPhotos.length} of ${photos.length}`}
              </span>
            </div>

            {/* Row 2: Search + Sort + Density */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-line/50">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={13}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted/80"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleLimit(pageSize);
                  }}
                  placeholder="Filter by title, camera, lens, location..."
                  aria-label="Filter photographs"
                  className="w-full bg-surface/75 border border-line pl-8 pr-7 py-1.5 font-mono text-xs text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none transition-colors rounded-[2px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 font-mono text-xs">
                <span className="sm:hidden text-[11px] text-ink-muted">
                  {filteredPhotos.length === photos.length
                    ? `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'frame' : 'frames'}`
                    : `${filteredPhotos.length} of ${photos.length}`}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                  }
                  className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  title="Toggle chronological sort"
                >
                  {sortOrder === 'newest' ? 'newest ↓' : 'oldest ↑'}
                </button>

                <div
                  role="group"
                  aria-label="Archive density"
                  className="inline-flex items-center gap-3 border-l border-line pl-4"
                >
                  {(['gallery', 'contact'] as const).map((mode) => {
                    const isActive = density === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleChangeDensity(mode)}
                        aria-pressed={isActive}
                        className={`relative pb-0.5 transition-colors duration-150 cursor-pointer ${
                          isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {mode}
                        {isActive && (
                          <motion.span
                            layoutId="photo-density-underline"
                            transition={TAB_SPRING}
                            className="absolute left-0 right-0 bottom-0 h-px bg-ink"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Inspection Stage (Zero Modal — Full Image + Camera/EXIF Spec Sheet) */}
          <AnimatePresence initial={false}>
            {selectedPhoto && (
              <motion.section
                ref={stageRef}
                key="inline-inspection-stage"
                aria-label="Selected photograph details"
                data-ascii-panel="true"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.34, ease: CALM_EASE }}
                className="overflow-hidden"
              >
                <div className="border border-line bg-surface/95 backdrop-blur-sm rounded-[2px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                  {/* Left: Uncropped full-frame photograph */}
                  <div className="lg:col-span-8 flex items-center justify-center p-4 sm:p-6 min-h-[280px] sm:min-h-[400px] lg:min-h-[480px] relative overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={selectedPhoto.id}
                        initial={{
                          opacity: 0,
                          x: prefersReducedMotion ? 0 : navDirection * 14,
                        }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{
                          opacity: 0,
                          x: prefersReducedMotion ? 0 : -navDirection * 14,
                        }}
                        transition={{ duration: 0.24, ease: CALM_EASE }}
                        className="w-full h-full flex items-center justify-center"
                      >
                        {!selectedPhoto.url || stageFailedUrl === selectedPhoto.url ? (
                          <p className="font-mono text-xs text-ink-muted py-16">
                            [ image unavailable ]
                          </p>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={selectedPhoto.url}
                            alt={selectedPhoto.title || 'Selected photograph'}
                            onError={() => setStageFailedUrl(selectedPhoto.url)}
                            className="max-h-[68vh] w-auto max-w-full object-contain block rounded-[1px]"
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Right: Editorial EXIF & Metadata Spec Sheet */}
                  <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-line p-4 sm:p-6 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
                          <span>
                            {formatFrameNumber(selectedIndex, filteredPhotos.length)} /{' '}
                            {String(filteredPhotos.length).padStart(
                              filteredPhotos.length >= 100 ? 3 : 2,
                              '0'
                            )}
                          </span>
                          {selectedPhoto.collection && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectCollection(selectedPhoto.collection!)
                                }
                                className="text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                              >
                                {selectedPhoto.collection}
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          aria-label="Close photograph details"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          <span>close</span>
                          <X size={13} />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <h2 className="font-mono text-base sm:text-lg font-medium text-ink leading-snug">
                          {selectedPhoto.title || 'Untitled'}
                        </h2>
                        {selectedPhoto.description && (
                          <p className="font-sans text-xs sm:text-sm text-ink/85 leading-relaxed">
                            {selectedPhoto.description}
                          </p>
                        )}
                      </div>

                      {/* Exposure Chips */}
                      {(selectedPhoto.focalLength ||
                        selectedPhoto.aperture ||
                        selectedPhoto.shutterSpeed ||
                        selectedPhoto.iso) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            selectedPhoto.focalLength,
                            selectedPhoto.aperture,
                            selectedPhoto.shutterSpeed,
                            selectedPhoto.iso,
                          ]
                            .filter(Boolean)
                            .map((val, i) => (
                              <span
                                key={`${val}-${i}`}
                                className="font-mono text-[11px] text-ink border border-line bg-bg/50 px-2 py-0.5 rounded-[2px]"
                              >
                                {val}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Structured Technical Metadata */}
                      <dl className="divide-y divide-line/60 border-t border-b border-line/60 font-mono text-[11px]">
                        {selectedPhoto.camera && (
                          <div className="py-2 flex items-baseline justify-between gap-4">
                            <dt className="text-ink-muted/80 shrink-0">camera</dt>
                            <dd className="text-ink text-right">{selectedPhoto.camera}</dd>
                          </div>
                        )}
                        {selectedPhoto.lens && (
                          <div className="py-2 flex items-baseline justify-between gap-4">
                            <dt className="text-ink-muted/80 shrink-0">lens</dt>
                            <dd className="text-ink text-right">{selectedPhoto.lens}</dd>
                          </div>
                        )}
                        {formatFullDate(selectedPhoto.takenAt || selectedPhoto.createdAt) && (
                          <div className="py-2 flex items-baseline justify-between gap-4">
                            <dt className="text-ink-muted/80 shrink-0">captured</dt>
                            <dd className="text-ink text-right">
                              {formatFullDate(
                                selectedPhoto.takenAt || selectedPhoto.createdAt
                              )}
                            </dd>
                          </div>
                        )}
                        {selectedPhoto.location && (
                          <div className="py-2 flex items-baseline justify-between gap-4">
                            <dt className="text-ink-muted/80 shrink-0">location</dt>
                            <dd className="text-ink text-right">{selectedPhoto.location}</dd>
                          </div>
                        )}
                        {selectedPhoto.width && selectedPhoto.height && (
                          <div className="py-2 flex items-baseline justify-between gap-4">
                            <dt className="text-ink-muted/80 shrink-0">format</dt>
                            <dd className="text-ink text-right">
                              {selectedPhoto.width} × {selectedPhoto.height} ·{' '}
                              {formatAspectRatio(
                                selectedPhoto.width,
                                selectedPhoto.height
                              )}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Prev / Next Navigation */}
                    {filteredPhotos.length > 1 && (
                      <div className="flex items-center justify-between gap-3 pt-2 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => handleStep(-1)}
                          className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 rounded-[2px] text-ink-muted hover:text-ink hover:border-ink/55 transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={13} />
                          <span>prev</span>
                        </button>
                        <span className="text-[11px] text-ink-muted/85 hidden sm:inline">
                          ← / → · esc
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStep(1)}
                          className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 rounded-[2px] text-ink-muted hover:text-ink hover:border-ink/55 transition-colors cursor-pointer"
                        >
                          <span>next</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Archive Grid */}
          {filteredPhotos.length === 0 ? (
            <div
              data-ascii-panel="true"
              className="border border-line bg-surface/80 rounded-[2px] py-12 px-6 text-center space-y-2"
            >
              <p className="font-mono text-xs text-ink">
                {photos.length === 0
                  ? 'No photographs archived yet.'
                  : 'No frames match this filter.'}
              </p>
              {(searchQuery || resolvedCollection !== ALL_COLLECTION) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCollection(ALL_COLLECTION);
                  }}
                  className="font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <>
              <ul
                role="list"
                className={
                  density === 'contact'
                    ? 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 w-full'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full'
                }
              >
                {visiblePhotos.map((photo, index) => (
                  <GalleryTile
                    key={photo.id}
                    photo={photo}
                    index={index}
                    total={filteredPhotos.length}
                    density={density}
                    isSelected={selectedId === photo.id}
                    onSelect={handleSelectTile}
                  />
                ))}
              </ul>

              {/* Progressive Pagination for 300+ Photo Archives */}
              {remainingCount > 0 && (
                <div
                  data-ascii-panel="true"
                  className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 font-mono text-xs"
                >
                  <span className="text-ink-muted">
                    Showing {visiblePhotos.length} of {filteredPhotos.length} frames
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + pageSize)}
                      className="border border-line bg-surface/85 px-3.5 py-1.5 rounded-[2px] text-ink hover:border-ink/60 transition-colors cursor-pointer"
                    >
                      Load {Math.min(pageSize, remainingCount)} more
                    </button>
                    {remainingCount > pageSize && (
                      <button
                        type="button"
                        onClick={() => setVisibleLimit(filteredPhotos.length)}
                        className="text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                      >
                        Show all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
