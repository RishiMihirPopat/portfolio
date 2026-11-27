'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Camera,
  Code,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  blocksToMarkdown,
  createBlockId,
  createEmptyParagraph,
  markdownToBlocks,
  type BlogBlock,
  type BlogBlockType,
} from '@/lib/blog-editor-codec';
import { compressImage } from '@/lib/image-processing';
import { estimateReadingMinutes, isSafeLinkHref } from '@/lib/markdown';
import { BlogArticleReader } from '@/components/blog/BlogArticleReader';
import {
  ACCORDION_TRANSITION,
  CALM_EASE,
  GLIDE_SPRING,
  TACTILE_SPRING,
} from '@/components/CollapsibleLog';
import {
  DANGER_INLINE_CLASS,
  INLINE_ACTION_CLASS,
  PRIMARY_BTN_CLASS,
} from '@/components/admin/shared';

interface BlogComposerTabProps {
  editingPostId: string | null;
  editorSessionKey: string;
  title: string;
  subtitle: string;
  tags: string[];
  content: string;
  imageUrl: string;
  isPreview: boolean;
  isPublishing: boolean;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onContentChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onPreviewChange: (value: boolean) => void;
  onCancelEdit: () => void;
  onLog: (msg: string) => void;
  onError: (msg: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const BLOCK_STYLE_OPTIONS: { value: BlogBlockType; label: string }[] = [
  { value: 'paragraph', label: 'Normal' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'quote', label: 'Quote' },
  { value: 'ul', label: 'Bullet list' },
  { value: 'ol', label: 'Numbered list' },
  { value: 'code', label: 'Code block' },
];

const TOOLBAR_BTN_CLASS =
  'min-w-[34px] min-h-[34px] px-1.5 inline-flex items-center justify-center rounded-[2px] text-ink-nav hover:text-ink hover:bg-ink/8 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default';

interface RichTextBlockProps {
  block: BlogBlock;
  syncVersion: number;
  isFirst: boolean;
  isActive: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onFocus: (id: string) => void;
  onHtmlChange: (id: string, html: string) => void;
  onEnterKey: (id: string) => void;
  onBackspaceEmpty: (id: string) => void;
  onPasteImageFiles: (id: string, files: File[]) => void;
}

function RichTextBlock({
  block,
  syncVersion,
  isFirst,
  registerRef,
  onFocus,
  onHtmlChange,
  onEnterKey,
  onBackspaceEmpty,
  onPasteImageFiles,
}: RichTextBlockProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedRef = useRef<string>(`${block.id}:${syncVersion}`);

  // Initialize innerHTML on mount and whenever undo/redo/session reload bumps syncVersion
  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const key = `${block.id}:${syncVersion}`;
    if (el.innerHTML !== block.html && (lastSyncedRef.current !== key || !el.innerHTML)) {
      el.innerHTML = block.html;
      lastSyncedRef.current = key;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, syncVersion]);

  // Seed initial HTML cleanly on first mount
  useEffect(() => {
    const el = localRef.current;
    if (el && block.html && el.innerHTML !== block.html) {
      el.innerHTML = block.html;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      block.type !== 'ul' &&
      block.type !== 'ol'
    ) {
      e.preventDefault();
      onEnterKey(block.id);
      return;
    }
    if (e.key === 'Backspace') {
      const text = (localRef.current?.textContent || '').trim();
      if (!text) {
        e.preventDefault();
        onBackspaceEmpty(block.id);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles = items
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => Boolean(f));

    if (imageFiles.length > 0) {
      e.preventDefault();
      onPasteImageFiles(block.id, imageFiles);
      return;
    }

    // Paste clean plain text to avoid external Substack/Word inline style pollution
    e.preventDefault();
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (plain) {
      document.execCommand('insertText', false, plain);
      if (localRef.current) {
        onHtmlChange(block.id, localRef.current.innerHTML);
      }
    }
  };

  const styleByType: Record<Exclude<BlogBlockType, 'image' | 'divider' | 'code'>, string> = {
    paragraph: 'font-sans text-sm sm:text-[15px] text-ink/95 leading-[1.78]',
    h2: 'font-mono text-lg sm:text-xl font-medium tracking-tight text-ink pt-3',
    h3: 'font-mono text-base sm:text-lg font-medium tracking-tight text-ink pt-2',
    quote:
      'font-sans text-sm sm:text-[15px] text-ink-nav leading-[1.75] border-l-2 border-ink pl-4 py-0.5',
    ul: 'font-sans text-sm sm:text-[15px] text-ink/95 leading-[1.75] pl-5 border-l border-line',
    ol: 'font-mono text-xs sm:text-sm text-ink/95 leading-[1.75] pl-5 border-l border-line',
  };

  const placeholderByType: Record<
    Exclude<BlogBlockType, 'image' | 'divider' | 'code'>,
    string
  > = {
    paragraph: isFirst ? 'Start writing, or paste / drop a photo inline...' : 'Write...',
    h2: 'Section heading...',
    h3: 'Subsection heading...',
    quote: 'Pull quote or note...',
    ul: 'List items (one per line)...',
    ol: 'Numbered items (one per line)...',
  };

  const blockType = block.type as Exclude<BlogBlockType, 'image' | 'divider' | 'code'>;

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        registerRef(block.id, node);
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${blockType} block`}
      data-placeholder={placeholderByType[blockType]}
      onFocus={() => onFocus(block.id)}
      onInput={(e) => onHtmlChange(block.id, e.currentTarget.innerHTML)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={`outline-none focus-visible:outline-none min-h-[1.75em] empty:before:content-[attr(data-placeholder)] empty:before:text-ink-muted empty:before:pointer-events-none [&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-bg/70 [&_code]:border [&_code]:border-line [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-[2px] ${styleByType[blockType]}`}
    />
  );
}

export function BlogComposerTab({
  editingPostId,
  editorSessionKey,
  title,
  subtitle,
  tags,
  content,
  imageUrl,
  isPreview,
  isPublishing,
  onTitleChange,
  onSubtitleChange,
  onTagsChange,
  onContentChange,
  onImageUrlChange,
  onPreviewChange,
  onCancelEdit,
  onLog,
  onError,
  onSubmit,
}: BlogComposerTabProps) {
  const [blocks, setBlocks] = useState<BlogBlock[]>(() => markdownToBlocks(content));
  const [activeBlockId, setActiveBlockId] = useState<string>(() => blocks[0]?.id || '');
  const [syncVersion, setSyncVersion] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isInsertingPhoto, setIsInsertingPhoto] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState('');

  // Undo / Redo history stacks
  const historyRef = useRef<BlogBlock[][]>([]);
  const futureRef = useRef<BlogBlock[][]>([]);
  const [historyDepth, setHistoryDepth] = useState({ undo: 0, redo: 0 });

  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const inlinePhotoInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const lastSessionRef = useRef(editorSessionKey);

  // Re-hydrate visual blocks whenever switching between New Post / Edit Post sessions
  useEffect(() => {
    if (lastSessionRef.current === editorSessionKey) return;
    lastSessionRef.current = editorSessionKey;
    const parsed = markdownToBlocks(content);
    setBlocks(parsed);
    setActiveBlockId(parsed[0]?.id || '');
    historyRef.current = [];
    futureRef.current = [];
    setHistoryDepth({ undo: 0, redo: 0 });
    setSyncVersion((v) => v + 1);
  }, [editorSessionKey, content]);

  const syncToParentMarkdown = useCallback(
    (nextBlocks: BlogBlock[]) => {
      onContentChange(blocksToMarkdown(nextBlocks));
    },
    [onContentChange]
  );

  const commitBlocks = useCallback(
    (
      updater: (prev: BlogBlock[]) => BlogBlock[],
      options?: { recordHistory?: boolean; bumpSync?: boolean }
    ) => {
      const recordHistory = options?.recordHistory ?? true;
      setBlocks((prev) => {
        const next = updater(prev);
        if (recordHistory) {
          historyRef.current = [...historyRef.current.slice(-39), prev];
          futureRef.current = [];
          setHistoryDepth({
            undo: historyRef.current.length,
            redo: 0,
          });
        }
        syncToParentMarkdown(next);
        return next;
      });
      if (options?.bumpSync) {
        setSyncVersion((v) => v + 1);
      }
    },
    [syncToParentMarkdown]
  );

  const focusBlock = useCallback((id: string, placeAtEnd = true) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(id);
      if (!el) return;
      el.focus();
      if (placeAtEnd && el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, []);

  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [blocks, ...futureRef.current.slice(0, 39)];
    setBlocks(previous);
    setSyncVersion((v) => v + 1);
    setHistoryDepth({ undo: historyRef.current.length, redo: futureRef.current.length });
    syncToParentMarkdown(previous);
  };

  const handleRedo = () => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [...historyRef.current.slice(-39), blocks];
    setBlocks(next);
    setSyncVersion((v) => v + 1);
    setHistoryDepth({ undo: historyRef.current.length, redo: futureRef.current.length });
    syncToParentMarkdown(next);
  };

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) || blocks[0],
    [blocks, activeBlockId]
  );

  const handleBlockTypeChange = (nextType: BlogBlockType) => {
    if (!activeBlock) return;
    if (activeBlock.type === 'image' || activeBlock.type === 'divider') {
      const created: BlogBlock = { id: createBlockId(), type: nextType, html: '' };
      commitBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === activeBlock.id);
        const copy = [...prev];
        copy.splice(idx + 1, 0, created);
        return copy;
      });
      setActiveBlockId(created.id);
      focusBlock(created.id);
      return;
    }

    commitBlocks(
      (prev) =>
        prev.map((b) => (b.id === activeBlock.id ? { ...b, type: nextType } : b)),
      { bumpSync: true }
    );
    focusBlock(activeBlock.id);
  };

  const applyInlineFormat = (
    command: 'bold' | 'italic' | 'strikeThrough' | 'code'
  ) => {
    if (!activeBlock || activeBlock.type === 'image' || activeBlock.type === 'divider' || activeBlock.type === 'code') {
      return;
    }
    const el = blockRefs.current.get(activeBlock.id);
    if (!el) return;
    el.focus();

    if (command === 'code') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const selected = sel.toString();
        if (selected) {
          document.execCommand(
            'insertHTML',
            false,
            `<code>${selected.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`
          );
        }
      }
    } else {
      document.execCommand(command, false);
    }

    commitBlocks(
      (prev) =>
        prev.map((b) =>
          b.id === activeBlock.id ? { ...b, html: el.innerHTML } : b
        ),
      { recordHistory: true }
    );
  };

  const openLinkPopover = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
    setLinkUrlDraft('https://');
    setShowLinkBar((prev) => !prev);
  };

  const applyLink = () => {
    const href = linkUrlDraft.trim();
    if (!href || !isSafeLinkHref(href)) {
      onError('Enter a valid https://, http://, or mailto: link.');
      return;
    }
    const targetBlock = activeBlock;
    if (!targetBlock) return;
    const el = blockRefs.current.get(targetBlock.id);
    if (el) {
      el.focus();
      if (savedSelectionRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedSelectionRef.current);
      }
      const selText = window.getSelection()?.toString() || href;
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${href.replace(/"/g, '&quot;')}">${selText.replace(/</g, '&lt;')}</a>`
      );
      commitBlocks((prev) =>
        prev.map((b) =>
          b.id === targetBlock.id ? { ...b, html: el.innerHTML } : b
        )
      );
    }
    setShowLinkBar(false);
    setLinkUrlDraft('');
  };

  const insertDividerBlock = () => {
    const divBlock: BlogBlock = { id: createBlockId(), type: 'divider', html: '' };
    const afterPara = createEmptyParagraph();
    commitBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === activeBlockId);
      const insertAt = idx === -1 ? prev.length : idx + 1;
      const copy = [...prev];
      copy.splice(insertAt, 0, divBlock, afterPara);
      return copy;
    });
    setActiveBlockId(afterPara.id);
    focusBlock(afterPara.id);
  };

  const insertImageFilesAfter = useCallback(
    async (afterBlockId: string | null, files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        onError('Please choose a valid image file.');
        return;
      }

      setIsInsertingPhoto(true);
      try {
        const insertedBlocks: BlogBlock[] = [];
        for (const file of imageFiles) {
          onLog(`Compressing inline photo: ${file.name}`);
          const dataUrl = await compressImage(file, 1400, 0.82);
          insertedBlocks.push({
            id: createBlockId(),
            type: 'image',
            html: '',
            src: dataUrl,
            caption: '',
          });
          onLog(`Inserted inline photo (${file.name}).`);
        }

        const trailingPara = createEmptyParagraph();
        commitBlocks((prev) => {
          const idx = afterBlockId
            ? prev.findIndex((b) => b.id === afterBlockId)
            : prev.length - 1;
          const insertAt = idx === -1 ? prev.length : idx + 1;
          const copy = [...prev];
          // If the target block is an empty paragraph and it's not the only block, replace it cleanly
          const current = copy[idx];
          if (
            current &&
            current.type === 'paragraph' &&
            !current.html.replace(/<[^>]+>/g, '').trim()
          ) {
            copy.splice(idx, 1, ...insertedBlocks, trailingPara);
          } else {
            copy.splice(insertAt, 0, ...insertedBlocks, trailingPara);
          }
          return copy;
        });

        setActiveBlockId(trailingPara.id);
        focusBlock(trailingPara.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Could not process inline image.';
        onError(message);
      } finally {
        setIsInsertingPhoto(false);
      }
    },
    [commitBlocks, focusBlock, onError, onLog]
  );

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onLog(`Compressing cover image: ${file.name}`);
      const dataUrl = await compressImage(file, 1400, 0.82);
      onImageUrlChange(dataUrl);
      onLog('Cover image ready.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not process cover image.';
      onError(message);
    }
    e.target.value = '';
  };

  const handleEnterKey = useCallback(
    (id: string) => {
      const nextPara = createEmptyParagraph();
      commitBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return [...prev, nextPara];
        const copy = [...prev];
        copy.splice(idx + 1, 0, nextPara);
        return copy;
      });
      setActiveBlockId(nextPara.id);
      focusBlock(nextPara.id);
    },
    [commitBlocks, focusBlock]
  );

  const handleBackspaceEmpty = useCallback(
    (id: string) => {
      let prevFocusId: string | null = null;
      commitBlocks((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((b) => b.id === id);
        if (idx <= 0) return prev;
        prevFocusId = prev[idx - 1].id;
        return prev.filter((b) => b.id !== id);
      });
      if (prevFocusId) {
        setActiveBlockId(prevFocusId);
        focusBlock(prevFocusId, true);
      }
    },
    [commitBlocks, focusBlock]
  );

  const moveBlock = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    commitBlocks((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removeBlock = (id: string) => {
    commitBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      return filtered.length > 0 ? filtered : [createEmptyParagraph()];
    });
  };

  const addTag = () => {
    const clean = tagDraft.trim();
    if (!clean) {
      setShowTagInput(false);
      return;
    }
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onTagsChange([...tags, clean].slice(0, 8));
    }
    setTagDraft('');
    setShowTagInput(false);
  };

  const handleCanvasDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.some((f) => f.type.startsWith('image/'))) {
      await insertImageFilesAfter(activeBlockId || null, files);
    }
  };

  const wordCount = useMemo(() => {
    const clean = content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/[#*_`~>[\]()-]/g, ' ')
      .trim();
    return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  }, [content]);

  const readMins = useMemo(() => estimateReadingMinutes(content), [content]);

  const publishPostLabel = isPublishing
    ? 'Saving...'
    : editingPostId
    ? 'Save changes'
    : 'Publish';

  const previewPost = useMemo(
    () => ({
      id: editingPostId || 'preview',
      title: title.trim() || 'Untitled post',
      subtitle: subtitle.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      content,
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    }),
    [editingPostId, title, subtitle, tags, content, imageUrl]
  );

  return (
    <form onSubmit={onSubmit} aria-label="Blog post composer" className="space-y-4">
      {/* Hidden file inputs */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={inlinePhotoInputRef}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) void insertImageFilesAfter(activeBlockId || null, files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={coverPhotoInputRef}
        onChange={handleCoverUpload}
        className="hidden"
      />

      {/* Top Composer Bar: Status + Write/Preview Switch + Publish */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ink-muted tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-ink-muted"
            />
            {editingPostId ? 'Editing published post' : 'Draft'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {readMins} min
          </span>
          {editingPostId && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onCancelEdit}
                className={DANGER_INLINE_CLASS}
              >
                Cancel edit
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <LayoutGroup id="admin-blog-mode">
            <div className="inline-flex p-0.5 border border-line-control bg-surface/85 rounded-[2px]">
              {(['write', 'preview'] as const).map((mode) => {
                const selected = mode === 'preview' ? isPreview : !isPreview;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onPreviewChange(mode === 'preview')}
                    className={`relative px-3 min-h-[34px] font-mono text-xs transition-colors cursor-pointer rounded-[1px] ${
                      selected ? 'text-bg' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="admin-blog-mode-pill"
                        transition={GLIDE_SPRING}
                        aria-hidden="true"
                        className="absolute inset-0 bg-ink rounded-[1px]"
                      />
                    )}
                    <span className="relative z-10">
                      {mode === 'write' ? 'Write' : 'Preview'}
                    </span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          <motion.button
            type="submit"
            disabled={isPublishing || isInsertingPhoto}
            whileHover={!isPublishing ? { y: -1 } : undefined}
            whileTap={!isPublishing ? { scale: 0.98 } : undefined}
            transition={TACTILE_SPRING}
            className={`${PRIMARY_BTN_CLASS} min-h-[38px] py-1.5`}
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
            <span>{publishPostLabel}</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isPreview ? (
          <motion.div
            key="blog-preview-canvas"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: CALM_EASE }}
            className="border border-line bg-surface/90 rounded-[2px] p-5 sm:p-8"
          >
            <BlogArticleReader post={previewPost} isPreview />
          </motion.div>
        ) : (
          <motion.div
            key="blog-write-canvas"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: CALM_EASE }}
            className="space-y-4"
          >
            {/* Substack-style Rich Formatting Toolbar */}
            <div
              role="toolbar"
              aria-label="Article formatting toolbar"
              className="flex flex-wrap items-center gap-1 border border-line-control bg-surface/92 px-2 py-1.5 rounded-[2px]"
            >
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyDepth.undo === 0}
                aria-label="Undo"
                title="Undo"
                className={TOOLBAR_BTN_CLASS}
              >
                <Undo2 size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyDepth.redo === 0}
                aria-label="Redo"
                title="Redo"
                className={TOOLBAR_BTN_CLASS}
              >
                <Redo2 size={14} aria-hidden="true" />
              </button>

              <span aria-hidden="true" className="w-px h-5 bg-line mx-1" />

              <select
                aria-label="Text block style"
                value={
                  activeBlock &&
                  activeBlock.type !== 'image' &&
                  activeBlock.type !== 'divider'
                    ? activeBlock.type
                    : 'paragraph'
                }
                onChange={(e) =>
                  handleBlockTypeChange(e.target.value as BlogBlockType)
                }
                className="min-h-[34px] bg-transparent border border-transparent hover:border-line px-2 font-mono text-xs text-ink cursor-pointer rounded-[2px]"
              >
                {BLOCK_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-bg text-ink">
                    {opt.label}
                  </option>
                ))}
              </select>

              <span aria-hidden="true" className="w-px h-5 bg-line mx-1" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyInlineFormat('bold')}
                aria-label="Bold"
                title="Bold"
                className={TOOLBAR_BTN_CLASS}
              >
                <Bold size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyInlineFormat('italic')}
                aria-label="Italic"
                title="Italic"
                className={TOOLBAR_BTN_CLASS}
              >
                <Italic size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyInlineFormat('strikeThrough')}
                aria-label="Strikethrough"
                title="Strikethrough"
                className={TOOLBAR_BTN_CLASS}
              >
                <Strikethrough size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyInlineFormat('code')}
                aria-label="Inline code"
                title="Inline code"
                className={TOOLBAR_BTN_CLASS}
              >
                <Code size={14} aria-hidden="true" />
              </button>

              <span aria-hidden="true" className="w-px h-5 bg-line mx-1" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openLinkPopover}
                aria-label="Insert link"
                title="Insert link"
                className={TOOLBAR_BTN_CLASS}
              >
                <Link2 size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => inlinePhotoInputRef.current?.click()}
                disabled={isInsertingPhoto}
                aria-label="Insert inline photo"
                title="Insert inline photo"
                className={`${TOOLBAR_BTN_CLASS} gap-1.5 px-2 font-mono text-xs text-ink`}
              >
                {isInsertingPhoto ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus size={14} aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Photo</span>
              </button>

              <span aria-hidden="true" className="w-px h-5 bg-line mx-1" />

              <button
                type="button"
                onClick={() => handleBlockTypeChange('quote')}
                aria-label="Quote block"
                title="Quote"
                className={TOOLBAR_BTN_CLASS}
              >
                <Quote size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleBlockTypeChange('ul')}
                aria-label="Bullet list"
                title="Bullet list"
                className={TOOLBAR_BTN_CLASS}
              >
                <List size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleBlockTypeChange('ol')}
                aria-label="Numbered list"
                title="Numbered list"
                className={TOOLBAR_BTN_CLASS}
              >
                <ListOrdered size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={insertDividerBlock}
                aria-label="Insert divider"
                title="Divider"
                className={TOOLBAR_BTN_CLASS}
              >
                <Minus size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Inline link insertion bar */}
            <AnimatePresence initial={false}>
              {showLinkBar && (
                <motion.div
                  key="inline-link-bar"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={ACCORDION_TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-2 border border-line-control bg-surface/90 px-3 py-2 rounded-[2px]">
                    <input
                      type="url"
                      value={linkUrlDraft}
                      onChange={(e) => setLinkUrlDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyLink();
                        } else if (e.key === 'Escape') {
                          setShowLinkBar(false);
                        }
                      }}
                      placeholder="https://example.com"
                      aria-label="Link URL"
                      className="flex-1 min-w-[200px] min-h-[34px] bg-bg/70 border border-line-control px-2.5 py-1 font-mono text-xs text-ink placeholder:text-ink-muted rounded-[2px]"
                    />
                    <button
                      type="button"
                      onClick={applyLink}
                      className="min-h-[34px] px-3 font-mono text-xs bg-ink text-bg rounded-[2px] cursor-pointer"
                    >
                      Apply link
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLinkBar(false)}
                      aria-label="Cancel link"
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Borderless Substack-Style Document Canvas */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => void handleCanvasDrop(e)}
              className={`border rounded-[2px] bg-surface/88 p-5 sm:p-8 space-y-5 transition-colors ${
                isDraggingOver
                  ? 'border-ink border-dashed bg-surface/95'
                  : 'border-line'
              }`}
            >
              {/* Title + Subtitle + Topic Pills + Optional Cover */}
              <div className="space-y-3 border-b border-line pb-5">
                <input
                  id="post-title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Title"
                  aria-label="Post title"
                  required
                  className="w-full bg-transparent font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink placeholder:text-ink-muted/75 outline-none focus-visible:outline-none"
                />

                <input
                  id="post-subtitle"
                  name="subtitle"
                  type="text"
                  value={subtitle}
                  onChange={(e) => onSubtitleChange(e.target.value)}
                  placeholder="Add a subtitle..."
                  aria-label="Post subtitle"
                  className="w-full bg-transparent font-sans text-base text-ink-nav placeholder:text-ink-muted/75 outline-none focus-visible:outline-none"
                />

                {/* Tags & Cover Trigger Row (mirrors Substack's author/tag chip row) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 border border-line-control bg-bg/70 pl-2.5 pr-1 font-mono text-xs text-ink rounded-[2px]"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onTagsChange(tags.filter((t) => t !== tag))
                        }
                        aria-label={`Remove topic ${tag}`}
                        className="min-w-[26px] min-h-[26px] inline-flex items-center justify-center text-ink-muted hover:text-danger cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {showTagInput ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addTag();
                          } else if (e.key === 'Escape') {
                            setShowTagInput(false);
                            setTagDraft('');
                          }
                        }}
                        onBlur={addTag}
                        autoFocus
                        placeholder="topic..."
                        aria-label="New topic tag"
                        className="w-28 min-h-[28px] bg-bg/70 border border-line-control px-2 font-mono text-xs text-ink rounded-[2px]"
                      />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTagInput(true)}
                      className="min-h-[30px] px-2 border border-line hover:border-ink/60 font-mono text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1 rounded-[2px] transition-colors cursor-pointer"
                    >
                      <Plus size={12} aria-hidden="true" />
                      <span>topic</span>
                    </button>
                  )}

                  <span aria-hidden="true" className="text-line mx-0.5">|</span>

                  <button
                    type="button"
                    onClick={() => coverPhotoInputRef.current?.click()}
                    className="min-h-[30px] px-2 border border-line hover:border-ink/60 font-mono text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1.5 rounded-[2px] transition-colors cursor-pointer"
                  >
                    <Camera size={12} aria-hidden="true" />
                    <span>{imageUrl ? 'change cover' : 'add cover'}</span>
                  </button>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => onImageUrlChange('')}
                      className="font-mono text-[11px] text-ink-muted hover:text-danger underline underline-offset-4 min-h-[30px] px-1 cursor-pointer"
                    >
                      remove cover
                    </button>
                  )}
                </div>

                {/* Optional Cover Photo Banner */}
                <AnimatePresence initial={false}>
                  {imageUrl && (
                    <motion.div
                      key="composer-cover-preview"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={ACCORDION_TRANSITION}
                      className="overflow-hidden pt-2"
                    >
                      <div className="border border-line rounded-[2px] overflow-hidden bg-bg/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt="Post cover preview"
                          className="w-full max-h-[260px] object-cover block"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* WYSIWYG Block & Inline Photo Flow */}
              <div className="space-y-4 min-h-[240px]">
                {blocks.map((block, index) => {
                  if (block.type === 'image') {
                    return (
                      <motion.figure
                        key={block.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: CALM_EASE }}
                        onClick={() => setActiveBlockId(block.id)}
                        className={`group relative border rounded-[2px] overflow-hidden bg-bg/50 transition-colors ${
                          activeBlockId === block.id
                            ? 'border-ink/70'
                            : 'border-line hover:border-ink/45'
                        }`}
                      >
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={block.src}
                            alt={block.caption || 'Inline post photograph'}
                            className="w-full h-auto max-h-[520px] object-contain bg-bg/60 block"
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-bg/90 border border-line-control rounded-[2px] p-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, -1);
                              }}
                              aria-label="Move photo up"
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={index === blocks.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, 1);
                              }}
                              aria-label="Move photo down"
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBlock(block.id);
                                onLog('Removed inline photo from post.');
                              }}
                              aria-label="Remove inline photo"
                              className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-ink-muted hover:text-danger cursor-pointer"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-line px-3 py-2">
                          <input
                            type="text"
                            value={block.caption || ''}
                            onFocus={() => setActiveBlockId(block.id)}
                            onChange={(e) => {
                              const nextCaption = e.target.value;
                              commitBlocks(
                                (prev) =>
                                  prev.map((b) =>
                                    b.id === block.id
                                      ? { ...b, caption: nextCaption }
                                      : b
                                  ),
                                { recordHistory: false }
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleEnterKey(block.id);
                              }
                            }}
                            placeholder="Write a caption (optional)..."
                            aria-label="Inline photo caption"
                            className="w-full bg-transparent text-center font-mono text-xs text-ink-muted placeholder:text-ink-muted/75 outline-none focus-visible:outline-none"
                          />
                        </div>
                      </motion.figure>
                    );
                  }

                  if (block.type === 'divider') {
                    return (
                      <div
                        key={block.id}
                        onClick={() => setActiveBlockId(block.id)}
                        className="group flex items-center gap-3 py-2"
                      >
                        <hr className="flex-1 border-line" />
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          aria-label="Remove divider"
                          className="opacity-60 group-hover:opacity-100 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-ink-muted hover:text-danger cursor-pointer transition-opacity"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  }

                  if (block.type === 'code') {
                    return (
                      <div
                        key={block.id}
                        className="relative border border-line-control bg-bg/75 rounded-[2px] overflow-hidden"
                      >
                        <textarea
                          ref={(node) => {
                            if (node) blockRefs.current.set(block.id, node);
                            else blockRefs.current.delete(block.id);
                          }}
                          value={block.html}
                          onFocus={() => setActiveBlockId(block.id)}
                          onChange={(e) => {
                            const val = e.target.value;
                            commitBlocks(
                              (prev) =>
                                prev.map((b) =>
                                  b.id === block.id ? { ...b, html: val } : b
                                ),
                              { recordHistory: false }
                            );
                          }}
                          rows={4}
                          placeholder="// code snippet..."
                          aria-label="Code block"
                          className="w-full bg-transparent p-3.5 font-mono text-xs text-ink leading-relaxed resize-y outline-none focus-visible:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          aria-label="Remove code block"
                          className="absolute top-1.5 right-1.5 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-ink-muted hover:text-danger cursor-pointer"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <RichTextBlock
                      key={block.id}
                      block={block}
                      syncVersion={syncVersion}
                      isFirst={index === 0}
                      isActive={activeBlockId === block.id}
                      registerRef={(id, el) => {
                        if (el) blockRefs.current.set(id, el);
                        else blockRefs.current.delete(id);
                      }}
                      onFocus={(id) => setActiveBlockId(id)}
                      onHtmlChange={(id, nextHtml) => {
                        commitBlocks(
                          (prev) =>
                            prev.map((b) =>
                              b.id === id ? { ...b, html: nextHtml } : b
                            ),
                          { recordHistory: false }
                        );
                      }}
                      onEnterKey={handleEnterKey}
                      onBackspaceEmpty={handleBackspaceEmpty}
                      onPasteImageFiles={(id, files) => {
                        void insertImageFilesAfter(id, files);
                      }}
                    />
                  );
                })}
              </div>

              {/* Bottom Quick-Insert Bar (add inline photo or paragraph smoothly) */}
              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => inlinePhotoInputRef.current?.click()}
                    disabled={isInsertingPhoto}
                    className={INLINE_ACTION_CLASS}
                  >
                    <ImagePlus size={13} className="mr-1.5" aria-hidden="true" />
                    Insert inline photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPara = createEmptyParagraph();
                      commitBlocks((prev) => [...prev, nextPara]);
                      setActiveBlockId(nextPara.id);
                      focusBlock(nextPara.id);
                    }}
                    className={INLINE_ACTION_CLASS}
                  >
                    <Plus size={13} className="mr-1" aria-hidden="true" />
                    Add paragraph
                  </button>
                </div>
                <span className="font-mono text-[11px] text-ink-muted">
                  Tip: paste or drag photos directly into the article
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
