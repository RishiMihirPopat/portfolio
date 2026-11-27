'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Link2 } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { profileData, type Post } from '@/lib/data';
import {
  createImgRenderer,
  createLinkRenderer,
  estimateReadingMinutes,
  extractDataImages,
  isSafeImageSrc,
} from '@/lib/markdown';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';

interface BlogArticleReaderProps {
  post: Post;
  prevPost?: Post | null;
  nextPost?: Post | null;
  isPreview?: boolean;
  onBack?: () => void;
  onSelectPost?: (post: Post) => void;
}

export function BlogArticleReader({
  post,
  prevPost = null,
  nextPost = null,
  isPreview = false,
  onBack,
  onSelectPost,
}: BlogArticleReaderProps) {
  const [readProgress, setReadProgress] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const readingMinutes = useMemo(
    () => estimateReadingMinutes(post.content),
    [post.content]
  );

  const { processed, images } = useMemo(
    () => extractDataImages(post.content),
    [post.content]
  );

  const imgRenderer = useMemo(() => createImgRenderer(images), [images]);
  const linkRenderer = useMemo(() => createLinkRenderer(), []);

  useEffect(() => {
    if (isPreview) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      setReadProgress(Math.min(1, Math.max(0, scrollTop / maxScroll)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPreview, post.id]);

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const formattedDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const showCover = Boolean(post.imageUrl && isSafeImageSrc(post.imageUrl));

  return (
    <MotionConfig reducedMotion="user">
      {/* Subtle 2px top reading progress bar */}
      {!isPreview && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-40 h-[2px] bg-transparent pointer-events-none"
        >
          <div
            style={{ transform: `scaleX(${readProgress})` }}
            className="h-full w-full origin-left bg-ink transition-transform duration-100 ease-out"
          />
        </div>
      )}

      <motion.article
        data-ascii-panel="true"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: CALM_EASE }}
        className={
          isPreview
            ? 'w-full space-y-6'
            : 'w-full max-w-[720px] mx-auto px-1 sm:px-4 space-y-7 pb-12'
        }
      >
        {/* Top utility bar */}
        {!isPreview && onBack && (
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <motion.button
              type="button"
              onClick={onBack}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={TACTILE_SPRING}
              className="quiet-link font-mono text-xs min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              <span>all posts</span>
            </motion.button>

            <motion.button
              type="button"
              onClick={handleCopyLink}
              whileTap={{ scale: 0.96 }}
              transition={TACTILE_SPRING}
              className="quiet-link font-mono text-xs min-h-[44px] sm:min-h-[36px] px-2 inline-flex items-center gap-1.5 cursor-pointer"
              aria-label="Copy link to this post"
            >
              {copiedLink ? (
                <>
                  <Check size={13} aria-hidden="true" />
                  <span>copied</span>
                </>
              ) : (
                <>
                  <Link2 size={13} aria-hidden="true" />
                  <span>share link</span>
                </>
              )}
            </motion.button>
          </div>
        )}

        {/* Editorial Article Header */}
        <header className="space-y-3.5 border-b border-line pb-6">
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[11px] text-ink-muted border border-line bg-surface/75 px-2 py-0.5 rounded-[2px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink leading-tight">
            {post.title || 'Untitled post'}
          </h1>

          {post.subtitle && (
            <p className="font-sans text-base sm:text-lg text-ink-nav leading-relaxed max-w-prose">
              {post.subtitle}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 font-mono text-xs text-ink-muted tabular-nums">
            <span className="text-ink">{profileData.name}</span>
            {formattedDate && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={post.createdAt}>{formattedDate}</time>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{readingMinutes} min read</span>
          </div>
        </header>

        {/* Optional Cover Photograph */}
        {showCover && post.imageUrl && (
          <figure className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-auto max-h-[480px] object-cover rounded-[2px] border border-line bg-surface/60"
            />
          </figure>
        )}

        {/* Long-form Substack-style Editorial Body with Inline Photos */}
        <div
          className="prose prose-sm sm:prose-base max-w-[68ch] font-sans text-ink/90
            prose-headings:font-mono prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-ink
            prose-h2:text-lg sm:prose-h2:text-xl prose-h2:mt-9 prose-h2:mb-3
            prose-h3:text-base sm:prose-h3:text-lg prose-h3:mt-7 prose-h3:mb-2
            prose-p:text-ink/90 prose-p:leading-[1.78] prose-p:my-4
            prose-strong:text-ink prose-strong:font-semibold
            prose-em:text-ink/95
            prose-a:text-ink prose-a:underline prose-a:underline-offset-4
            prose-li:text-ink/90 prose-li:leading-[1.7] prose-li:marker:text-ink-muted
            prose-blockquote:border-l-2 prose-blockquote:border-ink prose-blockquote:pl-4 prose-blockquote:not-italic prose-blockquote:text-ink-nav
            prose-hr:border-line prose-hr:my-8
            prose-code:font-mono prose-code:text-xs prose-code:text-ink prose-code:bg-surface/90 prose-code:border prose-code:border-line prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-[2px] prose-code:before:content-none prose-code:after:content-none
            prose-pre:text-ink prose-pre:bg-surface/90 prose-pre:border prose-pre:border-line prose-pre:rounded-[2px]
            prose-th:text-ink prose-td:text-ink/90 prose-thead:border-line prose-tr:border-line"
        >
          <ReactMarkdown
            components={{
              img: imgRenderer,
              a: linkRenderer,
            }}
          >
            {processed}
          </ReactMarkdown>
        </div>

        {/* Footer Prev / Next Post Navigation */}
        {!isPreview && (prevPost || nextPost || onBack) && (
          <footer className="border-t border-line pt-6 mt-10 space-y-5">
            {(prevPost || nextPost) && onSelectPost && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  {prevPost && (
                    <button
                      type="button"
                      onClick={() => onSelectPost(prevPost)}
                      className="group w-full text-left border border-line hover:border-ink/60 bg-surface/70 px-4 py-3 rounded-[2px] space-y-1 transition-colors cursor-pointer"
                    >
                      <span className="block font-mono text-[11px] text-ink-muted">
                        ← newer
                      </span>
                      <span className="block font-mono text-xs sm:text-sm text-ink truncate group-hover:underline underline-offset-4">
                        {prevPost.title}
                      </span>
                    </button>
                  )}
                </div>
                <div>
                  {nextPost && (
                    <button
                      type="button"
                      onClick={() => onSelectPost(nextPost)}
                      className="group w-full text-left sm:text-right border border-line hover:border-ink/60 bg-surface/70 px-4 py-3 rounded-[2px] space-y-1 transition-colors cursor-pointer"
                    >
                      <span className="block font-mono text-[11px] text-ink-muted">
                        older →
                      </span>
                      <span className="block font-mono text-xs sm:text-sm text-ink truncate group-hover:underline underline-offset-4">
                        {nextPost.title}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {onBack && (
              <div>
                <button
                  type="button"
                  onClick={onBack}
                  className="quiet-link font-mono text-xs min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
                >
                  <ArrowLeft size={13} aria-hidden="true" />
                  <span>back to all posts</span>
                </button>
              </div>
            )}
          </footer>
        )}
      </motion.article>
    </MotionConfig>
  );
}
