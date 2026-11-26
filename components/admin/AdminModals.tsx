'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { Photo, PhotoCollection } from '@/lib/data';
import type { PhotoExifMetadata } from '@/lib/exif';
import { TACTILE_SPRING } from '@/components/CollapsibleLog';
import { AdminModal } from '@/components/admin/AdminModal';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PHOTO_EXIF_FIELDS,
  PRIMARY_BTN_CLASS,
  SECONDARY_BTN_CLASS,
  type PendingDeleteTarget,
} from '@/components/admin/shared';

interface AdminModalsProps {
  allPhotos: Photo[];
  editingPhoto: Photo | null;
  editPhotoTitle: string;
  editPhotoDescription: string;
  editPhotoMeta: PhotoExifMetadata;
  onEditPhotoTitleChange: (value: string) => void;
  onEditPhotoDescriptionChange: (value: string) => void;
  onEditPhotoMetaChange: (patch: Partial<PhotoExifMetadata>) => void;
  onCloseEditPhoto: () => void;
  onSavePhotoMetadata: (e: React.FormEvent) => void;
  editingCollection: PhotoCollection | null;
  editColName: string;
  editColDescription: string;
  editColCoverPhotoId: string;
  editColHidden: boolean;
  onEditColNameChange: (value: string) => void;
  onEditColDescriptionChange: (value: string) => void;
  onEditColCoverPhotoIdChange: (value: string) => void;
  onEditColHiddenChange: (value: boolean) => void;
  onCloseEditCollection: () => void;
  onSaveCollectionSettings: (e: React.FormEvent) => void;
  pendingDelete: PendingDeleteTarget | null;
  onClosePendingDelete: () => void;
  onConfirmDelete: () => void;
}

export function AdminModals({
  allPhotos,
  editingPhoto,
  editPhotoTitle,
  editPhotoDescription,
  editPhotoMeta,
  onEditPhotoTitleChange,
  onEditPhotoDescriptionChange,
  onEditPhotoMetaChange,
  onCloseEditPhoto,
  onSavePhotoMetadata,
  editingCollection,
  editColName,
  editColDescription,
  editColCoverPhotoId,
  editColHidden,
  onEditColNameChange,
  onEditColDescriptionChange,
  onEditColCoverPhotoIdChange,
  onEditColHiddenChange,
  onCloseEditCollection,
  onSaveCollectionSettings,
  pendingDelete,
  onClosePendingDelete,
  onConfirmDelete,
}: AdminModalsProps) {
  return (
    <>
      {/* Edit photo metadata modal */}
      <AnimatePresence>
        {editingPhoto && (
          <AdminModal
            key="edit-photo-modal"
            onClose={onCloseEditPhoto}
            titleId="edit-photo-dialog-title"
            title="Edit photograph"
          >
            <div className="space-y-4">
              <div className="w-full h-40 border border-line overflow-hidden bg-surface flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editingPhoto.url}
                  alt={editingPhoto.title}
                  className="w-full h-full object-contain"
                />
              </div>
              <form onSubmit={onSavePhotoMetadata} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-photo-title" className={LABEL_CLASS}>
                    Title
                  </label>
                  <input
                    id="edit-photo-title"
                    type="text"
                    value={editPhotoTitle}
                    onChange={(e) => onEditPhotoTitleChange(e.target.value)}
                    className={INPUT_CLASS}
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-photo-desc" className={LABEL_CLASS}>
                    Description
                  </label>
                  <textarea
                    id="edit-photo-desc"
                    value={editPhotoDescription}
                    onChange={(e) => onEditPhotoDescriptionChange(e.target.value)}
                    rows={3}
                    className={`${INPUT_CLASS} resize-y`}
                    placeholder="Optional caption or notes..."
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {PHOTO_EXIF_FIELDS.map(([field, label, placeholder]) => (
                    <div key={field} className="space-y-1">
                      <label htmlFor={`edit-photo-${field}`} className={LABEL_CLASS}>
                        {label}
                      </label>
                      <input
                        id={`edit-photo-${field}`}
                        type="text"
                        list={
                          field === 'collection' ? 'photo-collections-list' : undefined
                        }
                        value={editPhotoMeta[field] || ''}
                        onChange={(e) =>
                          onEditPhotoMetaChange({ [field]: e.target.value })
                        }
                        className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={onCloseEditPhoto}
                    className={SECONDARY_BTN_CLASS}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={TACTILE_SPRING}
                    className={PRIMARY_BTN_CLASS}
                  >
                    Save changes
                  </motion.button>
                </div>
              </form>
            </div>
          </AdminModal>
        )}
      </AnimatePresence>

      {/* Edit collection settings modal */}
      <AnimatePresence>
        {editingCollection && (
          <AdminModal
            key="edit-collection-modal"
            onClose={onCloseEditCollection}
            titleId="edit-collection-dialog-title"
            title="Collection settings"
          >
            <form onSubmit={onSaveCollectionSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-col-name" className={LABEL_CLASS}>
                  Name (renaming updates all photos in this collection)
                </label>
                <input
                  id="edit-col-name"
                  type="text"
                  value={editColName}
                  onChange={(e) => onEditColNameChange(e.target.value)}
                  className={INPUT_CLASS}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-col-desc" className={LABEL_CLASS}>
                  Description
                </label>
                <textarea
                  id="edit-col-desc"
                  value={editColDescription}
                  onChange={(e) => onEditColDescriptionChange(e.target.value)}
                  rows={2}
                  className={`${INPUT_CLASS} resize-y`}
                  placeholder="Optional subtitle shown when visitors view this collection..."
                />
              </div>

              {/* Visual cover frame picker */}
              {(() => {
                const matchingPhotos = allPhotos.filter(
                  (p) =>
                    (p.collection || '').trim().toLowerCase() ===
                    editingCollection.name.trim().toLowerCase()
                );
                return (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={LABEL_CLASS}>Cover thumbnail</span>
                      <button
                        type="button"
                        onClick={() => onEditColCoverPhotoIdChange('')}
                        className={`font-mono text-[11px] min-h-[28px] px-1 cursor-pointer ${
                          !editColCoverPhotoId
                            ? 'text-ink underline underline-offset-4'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        Auto (latest)
                      </button>
                    </div>
                    {matchingPhotos.length === 0 ? (
                      <p className="font-sans text-xs text-ink-muted">
                        Assign photographs to this collection to pick a custom cover frame.
                      </p>
                    ) : (
                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                        {matchingPhotos.map((p) => {
                          const isPicked = editColCoverPhotoId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={isPicked}
                              onClick={() => onEditColCoverPhotoIdChange(p.id)}
                              title={p.title}
                              className={`relative aspect-square border overflow-hidden rounded-[2px] cursor-pointer transition-all ${
                                isPicked
                                  ? 'border-ink ring-1 ring-ink'
                                  : 'border-line opacity-75 hover:opacity-100'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.url}
                                alt={p.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <label className="flex items-center gap-2.5 pt-1 min-h-[36px] font-mono text-xs text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editColHidden}
                  onChange={(e) => onEditColHiddenChange(e.target.checked)}
                  className="accent-current cursor-pointer"
                />
                <span>Hide this collection and its photos from /photography</span>
              </label>

              <div className="pt-2 flex justify-end gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onCloseEditCollection}
                  className={SECONDARY_BTN_CLASS}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={TACTILE_SPRING}
                  className={PRIMARY_BTN_CLASS}
                >
                  Save settings
                </motion.button>
              </div>
            </form>
          </AdminModal>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {pendingDelete && (
          <AdminModal
            key="confirm-delete-modal"
            onClose={onClosePendingDelete}
            titleId="confirm-delete-title"
            title={
              pendingDelete.kind === 'post'
                ? 'Delete post'
                : pendingDelete.kind === 'collection'
                ? 'Remove collection'
                : 'Delete photograph'
            }
            maxWidthClass="max-w-md"
          >
            <div className="space-y-5">
              <p className="font-sans text-sm text-ink leading-relaxed">
                {pendingDelete.kind === 'collection' ? (
                  <>
                    Remove collection{' '}
                    <span className="font-mono">{pendingDelete.title}</span>? Your
                    photographs will stay safe in the archive as uncategorized.
                  </>
                ) : (
                  <>
                    Delete <span className="font-mono">{pendingDelete.title}</span>? This
                    cannot be undone.
                  </>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  type="button"
                  autoFocus
                  whileTap={{ scale: 0.98 }}
                  onClick={onClosePendingDelete}
                  className={SECONDARY_BTN_CLASS}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={TACTILE_SPRING}
                  onClick={onConfirmDelete}
                  className="font-mono text-xs px-4 py-2.5 min-h-[44px] bg-red-700 text-white dark:bg-red-500/90 dark:text-bg border border-red-700 dark:border-red-400 hover:opacity-90 transition-opacity cursor-pointer rounded-[2px]"
                >
                  {pendingDelete.kind === 'collection' ? 'Remove' : 'Delete'}
                </motion.button>
              </div>
            </div>
          </AdminModal>
        )}
      </AnimatePresence>
    </>
  );
}
