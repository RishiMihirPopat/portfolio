'use client';

import type { RefObject } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  createImgRenderer,
  createLinkRenderer,
  extractDataImages,
} from '@/lib/markdown';
import {
  ACCORDION_TRANSITION,
  CALM_EASE,
  GLIDE_SPRING,
  TACTILE_SPRING,
} from '@/components/CollapsibleLog';
import {
  DANGER_INLINE_CLASS,
  INLINE_ACTION_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BTN_CLASS,
  SECONDARY_BTN_CLASS,
  type InlineImageItem,
} from '@/components/admin/shared';

interface BlogComposerTabProps {
  editingPostId: string | null;
  title: string;
  content: string;
  imageUrl: string;
  isPreview: boolean;
  isPublishing: boolean;
  inlineImages: InlineImageItem[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  inlineImageRef: RefObject<HTMLInputElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onPreviewChange: (value: boolean) => void;
  onCancelEdit: () => void;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInlineImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveInlineImage: (img: InlineImageItem) => void;
  resolveInlineImages: (text: string) => string;
  onSubmit: (e: React.FormEvent) => void;
}

export function BlogComposerTab({
  editingPostId,
  title,
  content,
  imageUrl,
  isPreview,
  isPublishing,
  inlineImages,
  fileInputRef,
  inlineImageRef,
  textareaRef,
  onTitleChange,
  onContentChange,
  onImageUrlChange,
  onPreviewChange,
  onCancelEdit,
  onCoverUpload,
  onInlineImageUpload,
  onRemoveInlineImage,
  resolveInlineImages,
  onSubmit,
}: BlogComposerTabProps) {
  const publishPostLabel = isPublishing
    ? 'Saving...'
    : editingPostId
    ? 'Save changes'
    : 'Publish post';

  const renderPreviewContent = (text: string) => {
    const resolved = resolveInlineImages(text);
    const { processed, images } = extractDataImages(resolved);
    return (
      <ReactMarkdown
        components={{
          img: createImgRenderer(images),
          a: createLinkRenderer(),
        }}
      >
        {processed}
      </ReactMarkdown>
    );
  };

  return (
    <form onSubmit={onSubmit} aria-label="Blog post editor" className="space-y-5">
      <AnimatePresence initial={false}>
        {editingPostId && (
          <motion.div
            key="editing-post-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={ACCORDION_TRANSITION}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
              <span className="font-mono text-xs text-ink-muted">
                Editing existing post
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={TACTILE_SPRING}
                onClick={onCancelEdit}
                className={DANGER_INLINE_CLASS}
              >
                Cancel edit
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        <label htmlFor="post-title" className={LABEL_CLASS}>
          Title
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={INPUT_CLASS}
          placeholder="Notes on..."
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="post-cover" className={LABEL_CLASS}>
          Cover image (optional)
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="post-cover"
            name="coverImage"
            type="url"
            value={imageUrl}
            onChange={(e) => onImageUrlChange(e.target.value)}
            className={`${INPUT_CLASS} flex-1 font-mono`}
            placeholder="https://... or choose a file"
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={onCoverUpload}
            className="hidden"
          />
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={TACTILE_SPRING}
            onClick={() => fileInputRef.current?.click()}
            className={SECONDARY_BTN_CLASS}
          >
            <Camera size={14} aria-hidden="true" />
            <span>Choose file</span>
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {imageUrl && (
            <motion.div
              key="cover-preview"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={ACCORDION_TRANSITION}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-line mt-2">
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Cover preview"
                    width={48}
                    height={36}
                    className="w-12 h-9 object-cover border border-line shrink-0"
                  />
                  <span className="font-mono text-xs text-ink-muted truncate">
                    {imageUrl.startsWith('data:image')
                      ? 'Compressed cover image attached'
                      : imageUrl}
                  </span>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onImageUrlChange('')}
                  className={INLINE_ACTION_CLASS}
                >
                  Remove
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="post-body" className={LABEL_CLASS}>
            Body (Markdown)
          </label>
          <div className="flex items-center gap-3">
            <AnimatePresence initial={false}>
              {!isPreview && (
                <motion.div
                  key="insert-inline-photo"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.16, ease: CALM_EASE }}
                  className="inline-flex items-center"
                >
                  <input
                    type="file"
                    accept="image/*"
                    ref={inlineImageRef}
                    onChange={onInlineImageUpload}
                    className="hidden"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => inlineImageRef.current?.click()}
                    className={INLINE_ACTION_CLASS}
                  >
                    <ImagePlus size={13} className="mr-1" aria-hidden="true" />
                    Insert photo
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <LayoutGroup id="admin-markdown-mode">
              <div className="inline-flex p-0.5 border border-line-control bg-surface/85 rounded-[2px]">
                {(['edit', 'preview'] as const).map((mode) => {
                  const selected = mode === 'preview' ? isPreview : !isPreview;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onPreviewChange(mode === 'preview')}
                      className={`relative px-2.5 min-h-[32px] font-mono text-xs transition-colors cursor-pointer rounded-[1px] ${
                        selected ? 'text-bg' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="admin-markdown-mode-pill"
                          transition={GLIDE_SPRING}
                          aria-hidden="true"
                          className="absolute inset-0 bg-ink rounded-[1px]"
                        />
                      )}
                      <span className="relative z-10">
                        {mode === 'edit' ? 'Edit' : 'Preview'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isPreview && inlineImages.length > 0 && (
            <motion.div
              key="inline-images-tray"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={ACCORDION_TRANSITION}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 p-3 border border-line bg-surface/80 rounded-[2px]">
                <AnimatePresence initial={false} mode="popLayout">
                  {inlineImages.map((img) => (
                    <motion.div
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={TACTILE_SPRING}
                      className="relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover border border-line"
                      />
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onRemoveInlineImage(img)}
                        aria-label={`Remove inline image ${img.name}`}
                        className="absolute -top-2.5 -right-2.5 min-w-[26px] min-h-[26px] bg-bg border border-line-control text-ink hover:border-ink rounded-[2px] text-xs flex items-center justify-center cursor-pointer"
                      >
                        ×
                      </motion.button>
                      <p className="font-mono text-[11px] text-ink-muted truncate w-16 mt-1 text-center tabular-nums">
                        inline:{img.id}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {isPreview ? (
            <motion.div
              key="markdown-preview"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: CALM_EASE }}
              className="w-full min-h-[220px] bg-surface/90 border border-line-control p-4 sm:p-5 rounded-[2px] prose prose-sm prose-neutral max-w-prose font-sans prose-headings:font-medium prose-headings:text-ink prose-p:text-ink/90 prose-p:leading-relaxed prose-li:text-ink/90 prose-code:font-mono prose-code:text-xs dark:prose-invert"
            >
              {content ? (
                renderPreviewContent(content)
              ) : (
                <p className="text-ink-muted italic text-sm">
                  Nothing to preview yet.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="markdown-editor"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: CALM_EASE }}
            >
              <textarea
                ref={textareaRef}
                id="post-body"
                name="content"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                rows={9}
                className={`${INPUT_CLASS} font-mono text-xs sm:text-sm leading-relaxed min-h-[220px] resize-y`}
                placeholder="Write in Markdown..."
                required
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-2 flex justify-end">
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={publishPostLabel}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15, ease: CALM_EASE }}
            >
              {publishPostLabel}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </form>
  );
}
