'use client';

import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Post } from '@/lib/data';
import {
  estimateReadingMinutes,
  summarizeMarkdownExcerpt,
} from '@/lib/markdown';
import { CALM_EASE, TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  DANGER_INLINE_CLASS,
  INLINE_ACTION_CLASS,
} from '@/components/admin/shared';

interface BlogManageTabProps {
  posts: Post[];
  onNewPost: () => void;
  onEditPost: (post: Post) => void;
  onRequestDelete: (post: Post) => void;
}

export function BlogManageTab({
  posts,
  onNewPost,
  onEditPost,
  onRequestDelete,
}: BlogManageTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-sans text-xs sm:text-sm text-ink-muted">
          Published essays and notes on <span className="font-mono text-ink">/blog</span>.
        </p>
        <motion.button
          type="button"
          whileHover={{ y: -0.5 }}
          whileTap={{ scale: 0.97 }}
          transition={TACTILE_SPRING}
          onClick={onNewPost}
          className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
        >
          <Plus size={13} aria-hidden="true" />
          <span>New post</span>
        </motion.button>
      </div>

      <div className="divide-y divide-line border-t border-line">
        {posts.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-sans text-sm text-ink-muted py-6"
          >
            No blog posts published yet.
          </motion.p>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: CALM_EASE }}
                className="py-3.5 space-y-1.5"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h2 className="font-mono text-sm font-normal text-ink truncate">
                      {post.title}
                    </h2>
                    {post.tags &&
                      post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px]"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                  <span className="font-mono text-xs text-ink-muted shrink-0 tabular-nums">
                    {post.createdAt && (
                      <time dateTime={post.createdAt}>
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                        })}
                      </time>
                    )}
                    {' · '}
                    {estimateReadingMinutes(post.content)} min
                  </span>
                </div>
                <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed line-clamp-2">
                  {post.subtitle || summarizeMarkdownExcerpt(post.content, 160)}
                </p>
                <div className="flex items-center gap-4 pt-0.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onEditPost(post)}
                    className={INLINE_ACTION_CLASS}
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onRequestDelete(post)}
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
