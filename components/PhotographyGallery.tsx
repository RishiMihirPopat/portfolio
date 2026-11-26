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
  isLoading?: boolean;
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

function readColumnCount(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w < 640) return 1;
  if (w < 1024) return 2;
  return 3;
}

function useMasonryColumnCount(): number {
  const [cols, setCols] = useState<number>(readColumnCount);

  useEffect(() => {
    const update = () => setCols(readColumnCount());
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
            <h3 className="font-mono text-xs sm:text-[13px] font-normal text-ink truncate group-hover:underline underline-offset-4">
              {title}
            </h3>
            <span className="font-mono text-[11px] text-ink-muted shrink-0 flex items-baseline gap-2 tabular-nums">
              <span>{frameNo}</span>
              <span aria-hidden="true" className="text-ink">
                {isExpanded ? '−' : '+'}
              </span>
            </span>
          </div>
          {subline && (
            <p className="font-mono text-[11px] text-ink-muted truncate">
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
            <div className="border-t border-line px-3.5 py-3 space-y-3 bg-bg/40">
              {photo.description && (
                <p className="font-sans text-xs text-ink/90 leading-relaxed">
                  {photo.description}
                </p>
              )}

              <dl className="divide-y divide-line/60 border-t border-line/60 font-mono text-[11px] tabular-nums">
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
                    <dd className="text-ink text-right">
                      <time dateTime={dateSource}>{fullDate}</time>
                    </dd>
                  </div>
                )}
                {photo.location && (
                  <div className="py-1.5 flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">location</dt>
                    <dd className="text-ink text-right truncate">{photo.location}</dd>
                  </div>
                )}
                {photo.collection && (
                  <div className="py-1 flex items-center justify-between gap-3">
                    <dt className="text-ink-muted shrink-0">collection</dt>
                    <dd className="text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCollection(photo.collection!)}
                        className="text-ink hover:underline underline-offset-4 cursor-pointer min-h-[28px] px-1 inline-flex items-center"
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
  isLoading = false,
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

  // Build collections with admin order, custom cover photo, description, count, and derived series metadata
  const collections = useMemo(() => {
    const summarizeItems = (items: GalleryPhoto[]) => {
      const years: number[] = [];
      const locSet = new Set<string>();
      const camSet = new Set<string>();

      for (const item of items) {
        const rawDate = item.takenAt || item.createdAt;
        if (rawDate) {
          const d = new Date(rawDate);
          if (!Number.isNaN(d.getTime())) years.push(d.getFullYear());
        }
        const loc = item.location?.trim();
        if (loc && locSet.size < 2) locSet.add(loc);
        const cam = item.camera?.trim();
        if (cam && camSet.size < 2) camSet.add(cam);
      }

      let yearSpan: string | undefined;
      if (years.length > 0) {
        const minY = Math.min(...years);
        const maxY = Math.max(...years);
        yearSpan = minY === maxY ? String(minY) : `${minY} – ${maxY}`;
      }

      return {
        yearSpan,
        locations: Array.from(locSet),
        cameras: Array.from(camSet),
      };
    };

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
        const summary = summarizeItems(items);
        return {
          id: name,
          label: cfg?.name || name,
          description: cfg?.description,
          count: items.length,
          cover: customCover || items[0],
          previewCovers: items.slice(0, 4),
          order: cfg ? cfg.order : Number.MAX_SAFE_INTEGER,
          ...summary,
        };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          b.count - a.count ||
          a.label.localeCompare(b.label)
      );

    const allSummary = summarizeItems(publicPhotos);
    const list: {
      id: string;
      indexLabel: string;
      label: string;
      description?: string;
      count: number;
      cover?: GalleryPhoto;
      previewCovers: GalleryPhoto[];
      yearSpan?: string;
      locations: string[];
      cameras: string[];
      isArchiveAll?: boolean;
    }[] = [
      {
        id: ALL_COLLECTION,
        indexLabel: 'ALL',
        label: 'All Photographs',
        count: publicPhotos.length,
        cover: publicPhotos[0],
        previewCovers: publicPhotos.slice(0, 4),
        isArchiveAll: true,
        ...allSummary,
      },
      ...named.map((item, idx) => ({
        id: item.id,
        indexLabel: String(idx + 1).padStart(2, '0'),
        label: item.label,
        description: item.description,
        count: item.count,
        cover: item.cover,
        previewCovers: item.previewCovers,
        yearSpan: item.yearSpan,
        locations: item.locations,
        cameras: item.cameras,
      })),
    ];

    if (named.length > 0 && uncategorized.length > 0) {
      const uncatSummary = summarizeItems(uncategorized);
      list.push({
        id: UNCATEGORIZED_COLLECTION,
        indexLabel: 'MISC',
        label: 'Uncategorized',
        count: uncategorized.length,
        cover: uncategorized[0],
        previewCovers: uncategorized.slice(0, 4),
        ...uncatSummary,
      });
    }

    return list;
  }, [publicPhotos, configByName]);

  const hasNamedCollections = collections.length > 1;

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

  // Re-measure ASCII clear zones after loading, collection filter, expand, or pagination changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [isLoading, resolvedCollection, expandedId, visiblePhotos.length, effectiveColumnCount]);

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

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    currentIndex: number
  ) => {
    const totalTabs = collections.length;
    if (totalTabs === 0) return;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % totalTabs;
    else if (e.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + totalTabs) % totalTabs;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = totalTabs - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      const target = collections[nextIndex];
      handleSelectCollection(target.id);
      const tabEl = scrollerRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]'
      )[nextIndex];
      tabEl?.focus();
    }
  };

  const activeTabIndex = Math.max(
    0,
    collections.findIndex((c) => c.id === resolvedCollection)
  );
  const activeTabDomId = `gallery-tab-${activeTabIndex}`;

  const activeSeriesMetaLine = useMemo(() => {
    if (!activeCollectionMeta) return '';
    return [
      `${activeCollectionMeta.count} ${activeCollectionMeta.count === 1 ? 'frame' : 'frames'}`,
      activeCollectionMeta.yearSpan,
      ...activeCollectionMeta.locations,
      ...activeCollectionMeta.cameras,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [activeCollectionMeta]);

  if (isLoading) {
    const skeletonRatios = ['aspect-[4/3]', 'aspect-[3/4]', 'aspect-[4/3]'];
    return (
      <MotionConfig reducedMotion="user">
        <div
          aria-busy="true"
          aria-live="polite"
          className="space-y-10 sm:space-y-12 w-full max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-10 pt-2 pb-16"
        >
          {/* Series folio strip skeleton */}
          <div className="space-y-4">
            <div
              data-ascii-panel="true"
              className="border-t border-line pt-4 flex items-center justify-between gap-4"
            >
              <span className="font-mono text-xs text-ink-muted inline-flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="inline-block w-1.5 h-1.5 rounded-full bg-ink-muted motion-safe:animate-pulse"
                />
                loading photographs...
              </span>
            </div>
            <div
              aria-hidden="true"
              className="flex items-stretch gap-5 sm:gap-6 overflow-hidden"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  data-ascii-panel="true"
                  className="w-[228px] sm:w-[264px] shrink-0 border border-line/70 bg-surface/55 rounded-[2px] overflow-hidden motion-safe:animate-pulse"
                >
                  <div className="aspect-[4/3] w-full bg-ink/5" />
                  <div className="border-t border-line/60 px-3.5 py-3 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-2.5 w-8 bg-ink/10 rounded-[1px]" />
                      <div className="h-2.5 w-14 bg-ink/5 rounded-[1px]" />
                    </div>
                    <div className="h-3.5 w-2/3 bg-ink/10 rounded-[1px]" />
                    <div className="h-2.5 w-4/5 bg-ink/5 rounded-[1px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 lg:gap-12 items-start"
          >
            {[0, 1, 2].map((colIdx) => (
              <div
                key={colIdx}
                className={`flex-col gap-8 sm:gap-10 lg:gap-12 ${
                  colIdx === 0
                    ? 'flex'
                    : colIdx === 1
                    ? 'hidden sm:flex'
                    : 'hidden lg:flex'
                }`}
              >
                {[0, 1].map((rowIdx) => {
                  const ratio = skeletonRatios[(colIdx + rowIdx) % skeletonRatios.length];
                  return (
                    <div
                      key={rowIdx}
                      data-ascii-panel="true"
                      className="border border-line/70 bg-surface/50 rounded-[2px] overflow-hidden motion-safe:animate-pulse"
                    >
                      <div className={`${ratio} w-full bg-ink/5`} />
                      <div className="border-t border-line/60 px-3.5 py-3 space-y-2">
                        <div className="h-3 w-2/3 bg-ink/10 rounded-[1px]" />
                        <div className="h-2.5 w-1/3 bg-ink/5 rounded-[1px]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </MotionConfig>
    );
  }

  if (publicPhotos.length === 0) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="w-full max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-10 pt-2 pb-16">
          <motion.div
            data-ascii-panel="true"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: CALM_EASE }}
            className="border-t border-b border-line py-16 px-4 text-center space-y-2"
          >
            <p className="font-mono text-xs sm:text-sm text-ink">
              No photographs published yet.
            </p>
            <p className="font-sans text-xs text-ink-muted">
              Frames archived from the studio will appear here.
            </p>
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  const namedSeriesCount = collections.filter(
    (c) => c.id !== ALL_COLLECTION && c.id !== UNCATEGORIZED_COLLECTION
  ).length;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="photography-masonry">
        <div className="space-y-10 sm:space-y-12 w-full max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-10 pt-2 pb-16">
          {/* Curated Series Folio Shelf — first-class visual weight for collections */}
          {hasNamedCollections && (
            <section aria-labelledby="photography-series-heading" className="space-y-4">
              <div
                data-ascii-panel="true"
                className="flex items-center justify-between gap-4 border-t border-line pt-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2
                    id="photography-series-heading"
                    className="font-mono text-xs uppercase tracking-[0.14em] text-ink"
                  >
                    Collections
                  </h2>
                  <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {String(namedSeriesCount).padStart(2, '0')}{' '}
                    {namedSeriesCount === 1 ? 'series' : 'series'} ·{' '}
                    {publicPhotos.length}{' '}
                    {publicPhotos.length === 1 ? 'frame' : 'frames'}
                  </span>
                </div>

                {(canScrollLeft || canScrollRight) && (
                  <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => scrollCollectionsBy(-1)}
                      disabled={!canScrollLeft}
                      aria-label="Scroll collections left"
                      className="min-w-[34px] min-h-[34px] border border-line-control bg-surface/85 rounded-[2px] inline-flex items-center justify-center text-ink-muted hover:text-ink hover:border-ink disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCollectionsBy(1)}
                      disabled={!canScrollRight}
                      aria-label="Scroll collections right"
                      className="min-w-[34px] min-h-[34px] border border-line-control bg-surface/85 rounded-[2px] inline-flex items-center justify-center text-ink-muted hover:text-ink hover:border-ink disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <div
                ref={scrollerRef}
                role="tablist"
                aria-label="Photo collections"
                onScroll={updateScrollerState}
                onKeyDown={(e) => handleTabKeyDown(e, activeTabIndex)}
                className="flex items-stretch gap-5 sm:gap-6 overflow-x-auto py-2 px-1 -mx-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {collections.map((col, idx) => {
                  const isActive = resolvedCollection === col.id;
                  const showMosaic =
                    col.isArchiveAll && col.previewCovers.length >= 4;
                  const cardSubline =
                    col.description ||
                    [col.yearSpan, col.locations[0]].filter(Boolean).join(' · ') ||
                    (col.isArchiveAll ? 'Complete contact archive' : undefined);

                  return (
                    <button
                      key={col.id}
                      id={`gallery-tab-${idx}`}
                      data-ascii-panel="true"
                      type="button"
                      role="tab"
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-controls="photography-gallery-panel"
                      onClick={() => handleSelectCollection(col.id)}
                      className={`group relative w-[228px] sm:w-[268px] shrink-0 snap-start flex flex-col border rounded-[2px] overflow-hidden text-left transition-colors duration-200 cursor-pointer bg-surface/88 ${
                        isActive
                          ? 'border-ink text-ink'
                          : 'border-line text-ink-muted hover:border-ink/60 hover:text-ink'
                      }`}
                    >
                      {/* Substantial 4:3 Editorial Cover Frame */}
                      <div className="relative w-full aspect-[4/3] overflow-hidden bg-bg/70">
                        {showMosaic ? (
                          <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px bg-line">
                            {col.previewCovers.slice(0, 4).map((frame) => (
                              <div
                                key={frame.id}
                                className="relative w-full h-full overflow-hidden bg-surface"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={frame.url}
                                  alt=""
                                  width={140}
                                  height={105}
                                  loading="lazy"
                                  decoding="async"
                                  className={`w-full h-full object-cover motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.04] ${
                                    isActive
                                      ? 'opacity-100'
                                      : 'opacity-85 group-hover:opacity-100'
                                  }`}
                                />
                              </div>
                            ))}
                          </div>
                        ) : col.cover?.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={col.cover.url}
                            alt=""
                            width={268}
                            height={201}
                            loading={idx < 4 ? undefined : 'lazy'}
                            decoding="async"
                            className={`w-full h-full object-cover motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.03] ${
                              isActive
                                ? 'opacity-100'
                                : 'opacity-85 group-hover:opacity-100'
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-mono text-xs text-ink-muted">
                            —
                          </div>
                        )}
                      </div>

                      {/* Folio Caption Band */}
                      <div className="flex-1 flex flex-col justify-between gap-1.5 border-t border-line px-3.5 py-3">
                        <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-wider text-ink-muted tabular-nums">
                          <span>{col.indexLabel}</span>
                          <span>
                            {String(col.count).padStart(2, '0')}{' '}
                            {col.count === 1 ? 'frame' : 'frames'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-medium text-ink truncate group-hover:underline underline-offset-4">
                            {col.label}
                          </div>
                          {cardSubline && (
                            <p className="font-sans text-xs text-ink-muted truncate">
                              {cardSubline}
                            </p>
                          )}
                        </div>
                      </div>

                      {isActive && (
                        <motion.span
                          layoutId="collection-active-bar"
                          transition={TAB_SPRING}
                          aria-hidden="true"
                          className="absolute left-0 right-0 bottom-0 h-[2px] bg-ink"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Active Series Editorial Dossier Header + Subordinate Filter Controls */}
          <div
            data-ascii-panel="true"
            className="border-t border-b border-line py-5 sm:py-6 space-y-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              {/* Editorial Series Identity */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={resolvedCollection}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: CALM_EASE }}
                  className="space-y-1.5 min-w-0 flex-1"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted tabular-nums">
                    <span>
                      {activeCollectionMeta?.isArchiveAll
                        ? 'Complete Archive'
                        : activeCollectionMeta?.id === UNCATEGORIZED_COLLECTION
                        ? 'Uncategorized'
                        : `Series ${activeCollectionMeta?.indexLabel || ''}`}
                    </span>
                    {resolvedCollection !== ALL_COLLECTION && (
                      <>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => handleSelectCollection(ALL_COLLECTION)}
                          className="normal-case tracking-normal text-ink-nav hover:text-ink underline underline-offset-4 cursor-pointer min-h-[28px] inline-flex items-center"
                        >
                          all photographs
                        </button>
                      </>
                    )}
                  </div>

                  <h2 className="font-mono text-lg sm:text-xl font-medium tracking-tight text-ink">
                    {activeCollectionMeta?.label || 'All Photographs'}
                  </h2>

                  {activeCollectionMeta?.description && (
                    <p className="font-sans text-xs sm:text-sm text-ink-nav leading-relaxed max-w-prose">
                      {activeCollectionMeta.description}
                    </p>
                  )}

                  {activeSeriesMetaLine && (
                    <p className="font-mono text-[11px] text-ink-muted tabular-nums pt-0.5">
                      {activeSeriesMetaLine}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Subordinate Filter & Sort Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-64 lg:w-72">
                  <Search
                    size={13}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleLimit(PAGE_SIZE);
                    }}
                    placeholder="Filter title, camera, lens..."
                    aria-label="Filter photographs"
                    className="w-full min-h-[36px] bg-surface/75 border border-line-control pl-8 pr-9 py-1.5 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 transition-colors rounded-[2px]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear filter"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 font-mono text-xs shrink-0">
                  <span
                    aria-live="polite"
                    aria-atomic="true"
                    className="text-[11px] text-ink-muted tabular-nums"
                  >
                    {searchQuery
                      ? `${filteredPhotos.length} match${filteredPhotos.length === 1 ? '' : 'es'}`
                      : `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'frame' : 'frames'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                    }
                    className="min-h-[36px] px-2 -mr-2 text-ink-muted hover:text-ink transition-colors cursor-pointer inline-flex items-center whitespace-nowrap"
                  >
                    {sortOrder === 'newest' ? 'newest ↓' : 'oldest ↑'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Balanced Masonry Grid */}
          <div
            id="photography-gallery-panel"
            role={hasNamedCollections ? 'tabpanel' : undefined}
            aria-labelledby={hasNamedCollections ? activeTabDomId : undefined}
          >
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
                    className="min-h-[36px] px-2 font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                  >
                    reset filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-10 sm:space-y-12">
                <section
                  aria-label="Photography masonry gallery"
                  className="grid gap-8 sm:gap-10 lg:gap-12 items-start"
                  style={{
                    gridTemplateColumns: `repeat(${effectiveColumnCount}, minmax(0, 1fr))`,
                  }}
                >
                  {masonryColumns.map((columnItems, colIdx) => (
                    <div
                      key={colIdx}
                      className="flex flex-col gap-8 sm:gap-10 lg:gap-12 min-w-0"
                    >
                      {columnItems.map(({ photo, index }) => (
                        <MasonryCard
                          key={photo.id}
                          photo={photo}
                          index={index}
                          total={filteredPhotos.length}
                          isExpanded={expandedId === photo.id}
                          onToggleExpand={handleToggleExpand}
                          onSelectCollection={handleSelectCollection}
                        />
                      ))}
                    </div>
                  ))}
                </section>

                {/* Progressive Pagination for 300+ Photos */}
                {remainingCount > 0 && (
                  <div
                    data-ascii-panel="true"
                    className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 font-mono text-xs"
                  >
                    <span className="text-ink-muted tabular-nums">
                      Showing {visiblePhotos.length} of {filteredPhotos.length} frames
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                        className="border border-line-control bg-surface/85 px-3.5 min-h-[36px] rounded-[2px] text-ink hover:border-ink transition-colors cursor-pointer"
                      >
                        Load {Math.min(PAGE_SIZE, remainingCount)} more ↓
                      </button>
                      {remainingCount > PAGE_SIZE && (
                        <button
                          type="button"
                          onClick={() => setVisibleLimit(filteredPhotos.length)}
                          className="min-h-[36px] px-2 text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                        >
                          show all
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
