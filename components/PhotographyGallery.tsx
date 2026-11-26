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
import { Photo, PhotoCollection } from '@/lib/data';

export type GalleryPhoto = Photo & {
  width?: number;
  height?: number;
};

type GallerySort = 'newest' | 'oldest';

interface PhotographyGalleryProps {
  photos: GalleryPhoto[];
  collectionConfigs?: PhotoCollection[];
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
const PAGE_SIZE = 24;

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

function useMasonryColumnCount(): number {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 640) return 1;
      if (w < 1024) return 2;
      return 3;
    };
    const update = () => setCols(compute());
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

interface MasonryCardProps {
  photo: GalleryPhoto;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggleExpand: (photo: GalleryPhoto) => void;
  onSelectCollection: (collectionId: string) => void;
}

function MasonryCard({
  photo,
  index,
  total,
  isExpanded,
  onToggleExpand,
  onSelectCollection,
}: MasonryCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const width =
    typeof photo.width === 'number' && photo.width > 0 ? photo.width : undefined;
  const height =
    typeof photo.height === 'number' && photo.height > 0 ? photo.height : undefined;
  const hasDimensions = width !== undefined && height !== undefined;

  const isLoaded = loadedUrl === photo.url;
  const isUnavailable = !photo.url || failedUrl === photo.url;

  const dateSource = photo.takenAt || photo.createdAt;
  const shortDate = formatShortDate(dateSource);
  const fullDate = formatFullDate(dateSource);
  const frameNo = formatFrameNumber(index, total);
  const title = photo.title || 'Untitled';
  const detailsId = `masonry-details-${photo.id}`;

  const exposure = [
    photo.focalLength,
    photo.aperture,
    photo.shutterSpeed,
    photo.iso,
  ]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' · ');

  const subline = [photo.camera, photo.collection || shortDate]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.article
      data-ascii-panel="true"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.34,
        ease: CALM_EASE,
        delay: Math.min((index % 12) * 0.025, 0.2),
      }}
      className={`group relative border bg-surface/85 rounded-[2px] overflow-hidden transition-colors duration-200 ${
        isExpanded
          ? 'border-ink/70'
          : 'border-line hover:border-ink/55'
      }`}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => onToggleExpand(photo)}
        className="block w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px]"
      >
        <div
          className={`relative overflow-hidden bg-surface/95${
            !hasDimensions && !isLoaded && !isUnavailable ? ' min-h-[160px]' : ''
          }`}
        >
          {isUnavailable ? (
            <div
              className="flex min-h-[160px] w-full items-center justify-center px-3 py-8 text-center font-mono text-xs text-ink-muted"
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
              loading={index >= 6 ? 'lazy' : undefined}
              decoding={index >= 6 ? 'async' : undefined}
              fetchPriority={index === 0 ? 'high' : undefined}
              onLoad={() => setLoadedUrl(photo.url)}
              onError={() => setFailedUrl(photo.url)}
              className="w-full h-auto block motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.02]"
            />
          )}
        </div>

        <div className="border-t border-line px-3.5 py-2.5 space-y-0.5">
          <div className="flex items-baseline justify-between gap-2.5">
            <h2 className="font-mono text-xs sm:text-[13px] font-normal text-ink truncate group-hover:underline underline-offset-4">
              {title}
            </h2>
            <span className="font-mono text-[11px] text-ink-muted shrink-0 flex items-baseline gap-2">
              <span>{frameNo}</span>
              <span aria-hidden="true" className="text-ink/75">
                {isExpanded ? '−' : '+'}
              </span>
            </span>
          </div>
          {subline && (
            <p className="font-mono text-[11px] text-ink-muted/85 truncate">
              {subline}
            </p>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={detailsId}
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: CALM_EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-line/80 px-3.5 py-3 space-y-3 bg-bg/40">
              {photo.description && (
                <p className="font-sans text-xs text-ink/90 leading-relaxed">
                  {photo.description}
                </p>
              )}

              <dl className="divide-y divide-line/60 border-t border-line/60 font-mono text-[11px]">
                {photo.camera && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">camera</dt>
                    <dd className="text-ink text-right truncate">{photo.camera}</dd>
                  </div>
                )}
                {photo.lens && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">lens</dt>
                    <dd className="text-ink text-right truncate">{photo.lens}</dd>
                  </div>
                )}
                {exposure && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">settings</dt>
                    <dd className="text-ink text-right">{exposure}</dd>
                  </div>
                )}
                {fullDate && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">captured</dt>
                    <dd className="text-ink text-right">{fullDate}</dd>
                  </div>
                )}
                {photo.location && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">location</dt>
                    <dd className="text-ink text-right truncate">{photo.location}</dd>
                  </div>
                )}
                {photo.collection && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">collection</dt>
                    <dd className="text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCollection(photo.collection!)}
                        className="text-ink hover:underline underline-offset-4 cursor-pointer"
                      >
                        {photo.collection}
                      </button>
                    </dd>
                  </div>
                )}
                {hasDimensions && width && height && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">format</dt>
                    <dd className="text-ink text-right">
                      {width} × {height} · {formatAspectRatio(width, height)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export function PhotographyGallery({
  photos,
  collectionConfigs = [],
  onSelectPhoto,
}: PhotographyGalleryProps) {
  const columnCount = useMasonryColumnCount();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [activeCollection, setActiveCollection] = useState<string>(ALL_COLLECTION);
  const [sortOrder, setSortOrder] = useState<GallerySort>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Map managed collection configs by lowercase name for O(1) lookup
  const configByName = useMemo(() => {
    const map = new Map<string, PhotoCollection>();
    for (const cfg of collectionConfigs) {
      if (cfg.name.trim()) {
        map.set(cfg.name.trim().toLowerCase(), cfg);
      }
    }
    return map;
  }, [collectionConfigs]);

  const hiddenCollectionNames = useMemo(() => {
    const set = new Set<string>();
    for (const cfg of collectionConfigs) {
      if (cfg.hidden && cfg.name.trim()) {
        set.add(cfg.name.trim().toLowerCase());
      }
    }
    return set;
  }, [collectionConfigs]);

  // Exclude photos belonging to collections marked hidden in Admin
  const publicPhotos = useMemo(
    () =>
      photos.filter((photo) => {
        const col = photo.collection?.trim().toLowerCase();
        return !col || !hiddenCollectionNames.has(col);
      }),
    [photos, hiddenCollectionNames]
  );

  // Build collections with admin order, custom cover photo, description & count
  const collections = useMemo(() => {
    const buckets = new Map<string, GalleryPhoto[]>();
    const uncategorized: GalleryPhoto[] = [];

    for (const photo of publicPhotos) {
      const col = photo.collection?.trim();
      if (col) {
        const list = buckets.get(col) || [];
        list.push(photo);
        buckets.set(col, list);
      } else {
        uncategorized.push(photo);
      }
    }

    const photoById = new Map<string, GalleryPhoto>();
    for (const p of publicPhotos) {
      photoById.set(p.id, p);
    }

    const named = Array.from(buckets.entries())
      .map(([name, items]) => {
        const cfg = configByName.get(name.toLowerCase());
        const customCover = cfg?.coverPhotoId ? photoById.get(cfg.coverPhotoId) : undefined;
        return {
          id: name,
          label: cfg?.name || name,
          description: cfg?.description,
          count: items.length,
          cover: customCover || items[0],
          order: cfg ? cfg.order : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          b.count - a.count ||
          a.label.localeCompare(b.label)
      );

    const list: {
      id: string;
      label: string;
      description?: string;
      count: number;
      cover?: GalleryPhoto;
    }[] = [
      {
        id: ALL_COLLECTION,
        label: 'All',
        count: publicPhotos.length,
        cover: publicPhotos[0],
      },
      ...named,
    ];

    if (named.length > 0 && uncategorized.length > 0) {
      list.push({
        id: UNCATEGORIZED_COLLECTION,
        label: 'Uncategorized',
        count: uncategorized.length,
        cover: uncategorized[0],
      });
    }

    return list;
  }, [publicPhotos, configByName]);

  const resolvedCollection = useMemo(() => {
    if (activeCollection === ALL_COLLECTION) return ALL_COLLECTION;
    return collections.some((c) => c.id === activeCollection)
      ? activeCollection
      : ALL_COLLECTION;
  }, [activeCollection, collections]);

  const activeCollectionMeta = useMemo(
    () => collections.find((c) => c.id === resolvedCollection) || null,
    [collections, resolvedCollection]
  );

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = publicPhotos.filter((photo) => {
      const col = photo.collection?.trim() || '';
      if (resolvedCollection === UNCATEGORIZED_COLLECTION) {
        if (col) return false;
      } else if (resolvedCollection !== ALL_COLLECTION) {
        if (col !== resolvedCollection) return false;
      }

      if (!q) return true;
      const hay = [
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
      return hay.includes(q);
    });

    list.sort((a, b) => {
      const ta = getPhotoTimestamp(a);
      const tb = getPhotoTimestamp(b);
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    return list;
  }, [publicPhotos, resolvedCollection, searchQuery, sortOrder]);

  const visiblePhotos = useMemo(
    () => filteredPhotos.slice(0, visibleLimit),
    [filteredPhotos, visibleLimit]
  );

  const effectiveColumnCount =
    visiblePhotos.length > 0
      ? Math.min(columnCount, Math.max(2, visiblePhotos.length))
      : columnCount;

  // Shortest-column masonry distribution keeps row order top-to-bottom and prevents shifting on "Load more"
  const masonryColumns = useMemo(() => {
    const cols: { photo: GalleryPhoto; index: number }[][] = Array.from(
      { length: effectiveColumnCount },
      () => []
    );
    const heights = new Array<number>(effectiveColumnCount).fill(0);

    visiblePhotos.forEach((photo, index) => {
      let shortestIdx = 0;
      for (let c = 1; c < effectiveColumnCount; c++) {
        if (heights[c] < heights[shortestIdx]) {
          shortestIdx = c;
        }
      }
      cols[shortestIdx].push({ photo, index });
      const ratio =
        photo.width && photo.height && photo.width > 0
          ? photo.height / photo.width
          : 0.75;
      // Normalized image height + approximate caption chrome
      heights[shortestIdx] += ratio + 0.24;
    });

    return cols;
  }, [visiblePhotos, effectiveColumnCount]);

  // Monitor horizontal collection scroller overflow for subtle arrow controls
  const updateScrollerState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollerState();
    window.addEventListener('resize', updateScrollerState, { passive: true });
    return () => window.removeEventListener('resize', updateScrollerState);
  }, [updateScrollerState, collections.length]);

  const scrollCollectionsBy = (dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(240, el.clientWidth * 0.65),
      behavior: 'smooth',
    });
  };

  // Collapse inline details on Escape
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

  // Re-measure ASCII clear zones after collection filter / expand / pagination changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [resolvedCollection, expandedId, visiblePhotos.length, effectiveColumnCount]);

  const handleSelectCollection = (colId: string) => {
    setActiveCollection(colId);
    setVisibleLimit(PAGE_SIZE);
    setExpandedId(null);
  };

  const handleToggleExpand = (photo: GalleryPhoto) => {
    setExpandedId((prev) => (prev === photo.id ? null : photo.id));
    onSelectPhoto?.(photo);
  };

  const remainingCount = Math.max(0, filteredPhotos.length - visiblePhotos.length);

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="photography-masonry">
        <div className="space-y-10 sm:space-y-12 w-full max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-10 pt-2 pb-16">
          {/* Horizontal Collections Scroller */}
          <div data-ascii-panel="true" className="relative border-t border-b border-line py-4">
            <div className="flex items-center justify-between gap-4 pb-3">
              <span className="font-mono text-[11px] text-ink-muted">
                collections ({collections.length})
              </span>
              {(canScrollLeft || canScrollRight) && (
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => scrollCollectionsBy(-1)}
                    disabled={!canScrollLeft}
                    aria-label="Scroll collections left"
                    className="p-1 text-ink-muted hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default transition-opacity"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCollectionsBy(1)}
                    disabled={!canScrollRight}
                    aria-label="Scroll collections right"
                    className="p-1 text-ink-muted hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default transition-opacity"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={scrollerRef}
              role="tablist"
              aria-label="Photo collections"
              onScroll={updateScrollerState}
              className="flex items-stretch gap-3.5 overflow-x-auto pb-1.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    className={`relative shrink-0 snap-start flex items-center gap-3 pr-4 pl-2 py-2 border rounded-[2px] text-left transition-colors duration-150 cursor-pointer bg-surface/75 ${
                      isActive
                        ? 'border-ink/45 text-ink'
                        : 'border-line text-ink-muted hover:border-ink/40 hover:text-ink'
                    }`}
                  >
                    <div className="w-10 h-10 shrink-0 overflow-hidden border border-line/70 bg-bg/60 rounded-[1px]">
                      {col.cover?.url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={col.cover.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-ink-muted">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-[72px] space-y-0.5">
                      <div className="font-mono text-xs text-ink whitespace-nowrap">
                        {col.label}
                      </div>
                      <div className="font-mono text-[10px] text-ink-muted whitespace-nowrap">
                        {String(col.count).padStart(2, '0')}{' '}
                        {col.count === 1 ? 'frame' : 'frames'}
                      </div>
                    </div>
                    {isActive && (
                      <motion.span
                        layoutId="collection-active-bar"
                        transition={TAB_SPRING}
                        className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-ink"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secondary Filter + Sort Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-2.5 border-t border-line/50">
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
                    setVisibleLimit(PAGE_SIZE);
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

              <div className="flex items-center justify-between sm:justify-end gap-5 font-mono text-xs">
                <span className="text-[11px] text-ink-muted">
                  {filteredPhotos.length === publicPhotos.length
                    ? `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'frame' : 'frames'}`
                    : `${filteredPhotos.length} of ${publicPhotos.length}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                  }
                  className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {sortOrder === 'newest' ? 'newest ↓' : 'oldest ↑'}
                </button>
              </div>
            </div>

            {activeCollectionMeta?.description && (
              <p className="font-sans text-xs text-ink-muted leading-relaxed pt-2.5 mt-2.5 border-t border-line/40">
                {activeCollectionMeta.description}
              </p>
            )}
          </div>

          {/* Balanced Masonry Grid */}
          {filteredPhotos.length === 0 ? (
            <div
              data-ascii-panel="true"
              className="border-t border-b border-line py-10 px-4 text-center space-y-2"
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
                  reset filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                role="list"
                aria-label="Photography masonry gallery"
                className="grid gap-8 sm:gap-10 lg:gap-12 items-start"
                style={{
                  gridTemplateColumns: `repeat(${effectiveColumnCount}, minmax(0, 1fr))`,
                }}
              >
                {masonryColumns.map((columnItems, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-8 sm:gap-10 lg:gap-12 min-w-0">
                    {columnItems.map(({ photo, index }) => (
                      <div key={photo.id} role="listitem">
                        <MasonryCard
                          photo={photo}
                          index={index}
                          total={filteredPhotos.length}
                          isExpanded={expandedId === photo.id}
                          onToggleExpand={handleToggleExpand}
                          onSelectCollection={handleSelectCollection}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Progressive Pagination for 300+ Photos */}
              {remainingCount > 0 && (
                <div
                  data-ascii-panel="true"
                  className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 font-mono text-xs"
                >
                  <span className="text-ink-muted">
                    Showing {visiblePhotos.length} of {filteredPhotos.length} frames
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                      className="border border-line bg-surface/85 px-3.5 py-1.5 rounded-[2px] text-ink hover:border-ink/60 transition-colors cursor-pointer"
                    >
                      Load {Math.min(PAGE_SIZE, remainingCount)} more ↓
                    </button>
                    {remainingCount > PAGE_SIZE && (
                      <button
                        type="button"
                        onClick={() => setVisibleLimit(filteredPhotos.length)}
                        className="text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                      >
                        show all
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
