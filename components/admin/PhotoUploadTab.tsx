'use client';

import type { RefObject } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PHOTO_EXIF_FIELDS,
  PRIMARY_BTN_CLASS,
  SECONDARY_BTN_CLASS,
  type PendingPhoto,
} from '@/components/admin/shared';

interface PhotoUploadTabProps {
  pendingPhotos: PendingPhoto[];
  batchCollection: string;
  isDraggingPhotos: boolean;
  isPublishing: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  selectPhotosButtonRef: RefObject<HTMLButtonElement | null>;
  onBatchCollectionChange: (value: string) => void;
  onApplyBatchCollection: () => void;
  onDraggingChange: (dragging: boolean) => void;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDropFiles: (files: File[]) => void;
  onUpdatePendingPhoto: (index: number, patch: Partial<PendingPhoto>) => void;
  onRemovePendingPhoto: (photo: PendingPhoto) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PhotoUploadTab({
  pendingPhotos,
  batchCollection,
  isDraggingPhotos,
  isPublishing,
  photoInputRef,
  selectPhotosButtonRef,
  onBatchCollectionChange,
  onApplyBatchCollection,
  onDraggingChange,
  onFilesSelected,
  onDropFiles,
  onUpdatePendingPhoto,
  onRemovePendingPhoto,
  onSubmit,
}: PhotoUploadTabProps) {
  return (
    <form onSubmit={onSubmit} aria-label="Photo uploader" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-xs sm:text-sm text-ink-muted">
          Stage photographs with titles and captions before publishing.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={photoInputRef}
          onChange={onFilesSelected}
          className="hidden"
        />
        <motion.button
          ref={selectPhotosButtonRef}
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={TACTILE_SPRING}
          onClick={() => photoInputRef.current?.click()}
          className={SECONDARY_BTN_CLASS}
        >
          <Camera size={14} aria-hidden="true" />
          <span>Select files</span>
        </motion.button>
      </div>

      {pendingPhotos.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 border border-line bg-surface/60 p-3 rounded-[2px]">
          <div className="flex-1 space-y-1">
            <label htmlFor="batch-photo-collection" className={LABEL_CLASS}>
              Batch collection ({pendingPhotos.length} staged)
            </label>
            <input
              id="batch-photo-collection"
              type="text"
              list="photo-collections-list"
              value={batchCollection}
              onChange={(e) => onBatchCollectionChange(e.target.value)}
              className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
              placeholder="e.g. Coast, Monsoon, Japan 2026..."
            />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onApplyBatchCollection}
            className={`${SECONDARY_BTN_CLASS} min-h-[38px] py-1.5 shrink-0`}
          >
            Apply to all
          </motion.button>
        </div>
      )}

      <motion.div
        layout
        animate={{ scale: isDraggingPhotos ? 1.008 : 1 }}
        transition={TACTILE_SPRING}
        onDragOver={(e) => {
          e.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDraggingChange(false);
          const dropped = Array.from(e.dataTransfer.files || []);
          if (dropped.length) onDropFiles(dropped);
        }}
        className={`border border-dashed transition-colors rounded-[2px] overflow-hidden ${
          isDraggingPhotos ? 'border-ink bg-surface/90' : 'border-line-control'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {pendingPhotos.length === 0 ? (
            <motion.div
              key="empty-dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: CALM_EASE }}
              className="py-10 px-4 text-center space-y-1"
            >
              <p className="font-mono text-xs text-ink">
                Drop images here or choose files above.
              </p>
              <p className="font-sans text-xs text-ink-muted">
                Images are automatically resized and compressed before saving.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="staged-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-line"
            >
              <AnimatePresence initial={false}>
                {pendingPhotos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: CALM_EASE }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-full sm:w-24 h-24 shrink-0 border border-line overflow-hidden bg-surface">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.title || 'Staged photograph preview'}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 w-full space-y-2.5">
                        <div className="space-y-1">
                          <label
                            htmlFor={`staged-title-${photo.id}`}
                            className={LABEL_CLASS}
                          >
                            Title
                          </label>
                          <input
                            id={`staged-title-${photo.id}`}
                            type="text"
                            value={photo.title}
                            onChange={(e) =>
                              onUpdatePendingPhoto(index, { title: e.target.value })
                            }
                            className={INPUT_CLASS}
                            placeholder="Photograph title"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`staged-desc-${photo.id}`}
                            className={LABEL_CLASS}
                          >
                            Caption (optional)
                          </label>
                          <textarea
                            id={`staged-desc-${photo.id}`}
                            value={photo.description}
                            onChange={(e) =>
                              onUpdatePendingPhoto(index, { description: e.target.value })
                            }
                            rows={2}
                            className={`${INPUT_CLASS} font-sans resize-y`}
                            placeholder="Location, camera notes, or context..."
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                          {PHOTO_EXIF_FIELDS.map(([field, label, placeholder]) => (
                            <div key={field} className="space-y-1">
                              <label
                                htmlFor={`staged-${field}-${photo.id}`}
                                className={LABEL_CLASS}
                              >
                                {label}
                              </label>
                              <input
                                id={`staged-${field}-${photo.id}`}
                                type="text"
                                list={
                                  field === 'collection'
                                    ? 'photo-collections-list'
                                    : undefined
                                }
                                value={photo[field] || ''}
                                onChange={(e) =>
                                  onUpdatePendingPhoto(index, {
                                    [field]: e.target.value,
                                  })
                                }
                                className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
                                placeholder={placeholder}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        transition={TACTILE_SPRING}
                        onClick={() => onRemovePendingPhoto(photo)}
                        aria-label={`Remove ${photo.title || 'staged photo'}`}
                        className="text-ink-muted hover:text-danger p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center self-end sm:self-start cursor-pointer transition-colors"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="pt-1 flex justify-end">
        <motion.button
          type="submit"
          disabled={isPublishing}
          whileHover={!isPublishing ? { y: -1 } : undefined}
          whileTap={!isPublishing ? { scale: 0.98 } : undefined}
          transition={TACTILE_SPRING}
          className={PRIMARY_BTN_CLASS}
        >
          {isPublishing && (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
              className="inline-flex"
            >
              <Loader2 size={14} aria-hidden="true" />
            </motion.span>
          )}
          <span>{isPublishing ? 'Uploading...' : 'Publish photos'}</span>
        </motion.button>
      </div>
    </form>
  );
}
