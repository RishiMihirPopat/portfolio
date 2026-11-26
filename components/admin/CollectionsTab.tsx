'use client';

import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Photo, PhotoCollection } from '@/lib/data';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  DANGER_INLINE_CLASS,
  INLINE_ACTION_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BTN_CLASS,
} from '@/components/admin/shared';

interface CollectionsTabProps {
  allCollections: PhotoCollection[];
  allPhotos: Photo[];
  adHocCollectionNames: string[];
  photoCountByCollection: {
    counts: Map<string, number>;
    uncategorized: number;
  };
  newColName: string;
  newColDescription: string;
  newColHidden: boolean;
  onNewColNameChange: (value: string) => void;
  onNewColDescriptionChange: (value: string) => void;
  onNewColHiddenChange: (value: boolean) => void;
  onCreateCollection: (e: React.FormEvent) => void;
  onReorderCollection: (index: number, delta: -1 | 1) => void;
  onToggleVisibility: (col: PhotoCollection) => void;
  onEditCollection: (col: PhotoCollection) => void;
  onRequestDelete: (col: PhotoCollection) => void;
  onRegisterAdHoc: (name: string) => void;
}

export function CollectionsTab({
  allCollections,
  allPhotos,
  adHocCollectionNames,
  photoCountByCollection,
  newColName,
  newColDescription,
  newColHidden,
  onNewColNameChange,
  onNewColDescriptionChange,
  onNewColHiddenChange,
  onCreateCollection,
  onReorderCollection,
  onToggleVisibility,
  onEditCollection,
  onRequestDelete,
  onRegisterAdHoc,
}: CollectionsTabProps) {
  return (
    <div className="space-y-6">
      <p className="font-sans text-xs sm:text-sm text-ink-muted">
        Control collection order, descriptions, cover frames, and gallery visibility for
        the horizontal scroller on <span className="font-mono text-ink">/photography</span>.
      </p>

      {/* Create new collection form */}
      <form
        onSubmit={onCreateCollection}
        aria-label="Create photo collection"
        className="space-y-3 border border-line bg-surface/60 p-3.5 rounded-[2px]"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="new-col-name" className={LABEL_CLASS}>
              Collection name
            </label>
            <input
              id="new-col-name"
              type="text"
              value={newColName}
              onChange={(e) => onNewColNameChange(e.target.value)}
              className={INPUT_CLASS}
              placeholder="e.g. Coast, Japan 2026"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-col-desc" className={LABEL_CLASS}>
              Description (optional)
            </label>
            <input
              id="new-col-desc"
              type="text"
              value={newColDescription}
              onChange={(e) => onNewColDescriptionChange(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Short note shown below the scroller..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 min-h-[36px] font-mono text-xs text-ink-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newColHidden}
              onChange={(e) => onNewColHiddenChange(e.target.checked)}
              className="accent-current cursor-pointer"
            />
            <span>Start hidden (draft)</span>
          </label>
          <motion.button
            type="submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={TACTILE_SPRING}
            className={PRIMARY_BTN_CLASS}
          >
            <Plus size={13} aria-hidden="true" />
            <span>Create collection</span>
          </motion.button>
        </div>
      </form>

      {/* Managed collections list */}
      <div className="divide-y divide-line border-t border-line">
        {allCollections.length === 0 ? (
          <p className="font-sans text-sm text-ink-muted py-6">
            No managed collections yet. Create one above to control scroller order, cover
            frames, and visibility.
          </p>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {allCollections.map((col, idx) => {
              const colPhotos = allPhotos.filter(
                (p) =>
                  (p.collection || '').trim().toLowerCase() ===
                  col.name.trim().toLowerCase()
              );
              const coverPhoto =
                (col.coverPhotoId &&
                  colPhotos.find((p) => p.id === col.coverPhotoId)) ||
                colPhotos[0];

              return (
                <motion.div
                  key={col.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: CALM_EASE }}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-12 h-12 shrink-0 border border-line overflow-hidden bg-surface flex items-center justify-center">
                      {coverPhoto?.url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={coverPhoto.url}
                          alt={col.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-ink-muted">—</span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-mono text-sm font-normal text-ink truncate tabular-nums">
                          {String(idx + 1).padStart(2, '0')} · {col.name}
                        </h2>
                        <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                          {colPhotos.length}{' '}
                          {colPhotos.length === 1 ? 'frame' : 'frames'}
                        </span>
                        {col.hidden && (
                          <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px]">
                            hidden
                          </span>
                        )}
                      </div>
                      {col.description && (
                        <p className="font-sans text-xs text-ink-muted line-clamp-2">
                          {col.description}
                        </p>
                      )}
                      <p className="font-mono text-[11px] text-ink-muted">
                        cover:{' '}
                        {col.coverPhotoId && coverPhoto
                          ? coverPhoto.title
                          : coverPhoto
                          ? 'auto (latest)'
                          : 'none'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <div className="inline-flex items-center gap-0.5 border border-line-control rounded-[2px]">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onReorderCollection(idx, -1)}
                        aria-label={`Move ${col.name} earlier`}
                        title="Move earlier in scroller"
                        className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer disabled:cursor-default transition-opacity"
                      >
                        <ArrowUp size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === allCollections.length - 1}
                        onClick={() => onReorderCollection(idx, 1)}
                        aria-label={`Move ${col.name} later`}
                        title="Move later in scroller"
                        className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer disabled:cursor-default transition-opacity"
                      >
                        <ArrowDown size={13} aria-hidden="true" />
                      </button>
                    </div>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onToggleVisibility(col)}
                      className="font-mono text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                      title={
                        col.hidden
                          ? 'Show in public gallery'
                          : 'Hide from public gallery'
                      }
                    >
                      {col.hidden ? (
                        <Eye size={13} aria-hidden="true" />
                      ) : (
                        <EyeOff size={13} aria-hidden="true" />
                      )}
                      <span>{col.hidden ? 'Show' : 'Hide'}</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onEditCollection(col)}
                      className={INLINE_ACTION_CLASS}
                    >
                      Settings
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onRequestDelete(col)}
                      className={DANGER_INLINE_CLASS}
                    >
                      Remove
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Unregistered collection tags found on photos */}
      {adHocCollectionNames.length > 0 && (
        <div className="border-t border-line pt-4 space-y-2.5">
          <div className="space-y-0.5">
            <h2 className="font-mono text-xs text-ink tabular-nums">
              Unmanaged tags on photos ({adHocCollectionNames.length})
            </h2>
            <p className="font-sans text-xs text-ink-muted">
              These collections exist on uploaded photos without saved settings. Promote
              them to customize order, cover, or description.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {adHocCollectionNames.map((name) => {
              const count = photoCountByCollection.counts.get(name.toLowerCase()) || 0;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onRegisterAdHoc(name)}
                  className="font-mono text-xs border border-line-control bg-surface/80 px-2.5 min-h-[36px] rounded-[2px] text-ink hover:border-ink transition-colors inline-flex items-center gap-2 cursor-pointer tabular-nums"
                >
                  <span>
                    {name} ({count})
                  </span>
                  <span className="text-ink-muted">+ manage</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
