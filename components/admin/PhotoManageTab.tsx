'use client';

import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Photo } from '@/lib/data';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  DANGER_INLINE_CLASS,
  INLINE_ACTION_CLASS,
} from '@/components/admin/shared';

interface PhotoManageTabProps {
  allPhotos: Photo[];
  filteredPhotos: Photo[];
  existingCollections: string[];
  photoCountByCollection: {
    counts: Map<string, number>;
    uncategorized: number;
  };
  photoFilterCollection: string;
  onFilterCollectionChange: (value: string) => void;
  onOpenCollectionsTab: () => void;
  onOpenUploadTab: () => void;
  onEditPhoto: (photo: Photo) => void;
  onRequestDelete: (photo: Photo) => void;
}

export function PhotoManageTab({
  allPhotos,
  filteredPhotos,
  existingCollections,
  photoCountByCollection,
  photoFilterCollection,
  onFilterCollectionChange,
  onOpenCollectionsTab,
  onOpenUploadTab,
  onEditPhoto,
  onRequestDelete,
}: PhotoManageTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-sans text-xs sm:text-sm text-ink-muted">
          Archived photographs shown in the photography gallery.
        </p>
        <div className="flex items-center gap-4">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onOpenCollectionsTab}
            className="font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer min-h-[36px]"
          >
            Collections settings
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ y: -0.5 }}
            whileTap={{ scale: 0.97 }}
            transition={TACTILE_SPRING}
            onClick={onOpenUploadTab}
            className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
          >
            <Plus size={13} aria-hidden="true" />
            <span>Upload photos</span>
          </motion.button>
        </div>
      </div>

      {allPhotos.length > 0 && existingCollections.length > 0 && (
        <div
          role="group"
          aria-label="Filter photos by collection"
          className="flex items-center gap-3 overflow-x-auto pb-1 font-mono text-[11px] tabular-nums [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[
            { id: '__all__', label: `All (${allPhotos.length})` },
            ...existingCollections.map((name) => ({
              id: name,
              label: `${name} (${photoCountByCollection.counts.get(name.toLowerCase()) || 0})`,
            })),
            ...(photoCountByCollection.uncategorized > 0
              ? [
                  {
                    id: '__uncategorized__',
                    label: `Uncategorized (${photoCountByCollection.uncategorized})`,
                  },
                ]
              : []),
          ].map((item) => {
            const isActive = photoFilterCollection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterCollectionChange(item.id)}
                className={`whitespace-nowrap min-h-[32px] pb-1 border-b transition-colors cursor-pointer ${
                  isActive
                    ? 'text-ink border-ink'
                    : 'text-ink-muted border-transparent hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="divide-y divide-line border-t border-line">
        {filteredPhotos.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-sans text-sm text-ink-muted py-6"
          >
            {allPhotos.length === 0
              ? 'No photographs archived yet.'
              : 'No photographs in this collection.'}
          </motion.p>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {filteredPhotos.map((photo) => (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: CALM_EASE }}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-14 h-14 shrink-0 border border-line overflow-hidden bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.title}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-mono text-sm font-normal text-ink truncate">
                        {photo.title}
                      </h2>
                      {photo.collection && (
                        <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px] shrink-0">
                          {photo.collection}
                        </span>
                      )}
                    </div>
                    {photo.description && (
                      <p className="font-sans text-xs sm:text-sm text-ink-muted truncate">
                        {photo.description}
                      </p>
                    )}
                    {photo.createdAt && (
                      <p className="font-mono text-xs text-ink-muted tabular-nums">
                        <time dateTime={photo.createdAt}>
                          {new Date(photo.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                          })}
                        </time>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onEditPhoto(photo)}
                    className={INLINE_ACTION_CLASS}
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onRequestDelete(photo)}
                    className={DANGER_INLINE_CLASS}
                  >
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
