'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { profileData, type Post } from '@/lib/data';
import { fetchAllPosts } from '@/lib/storage';
import {
  estimateReadingMinutes,
  extractFirstMarkdownImage,
  isSafeImageSrc,
  summarizeMarkdownExcerpt,
} from '@/lib/markdown';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { CALM_EASE } from '@/components/CollapsibleLog';

const BlogArticleReader = dynamic(
  () =>
    import('@/components/blog/BlogArticleReader').then(
      (mod) => mod.BlogArticleReader
    ),
  {
    ssr: false,
    loading: () => (
      <div
        data-ascii-panel="true"
        aria-busy="true"
        className="w-full max-w-[720px] mx-auto px-1 sm:px-4 space-y-6 py-4 motion-safe:animate-pulse"
      >
        <div className="h-4 w-24 bg-ink/10 rounded-[1px]" />
        <div className="space-y-3 border-b border-line pb-6">
          <div className="h-7 w-3/4 bg-ink/10 rounded-[1px]" />
          <div className="h-4 w-2/3 bg-ink/5 rounded-[1px]" />
          <div className="h-3 w-40 bg-ink/5 rounded-[1px]" />
        </div>
        <div className="space-y-3">
          <div className="h-3.5 w-full bg-ink/5 rounded-[1px]" />
          <div className="h-3.5 w-11/12 bg-ink/5 rounded-[1px]" />
          <div className="h-3.5 w-4/5 bg-ink/5 rounded-[1px]" />
        </div>
      </div>
    ),
  }
);

function readPostIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('post');
}

export function BlogSection() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('__all__');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await fetchAllPosts();
        if (!active) return;
        setPosts(loaded);
        const urlId = readPostIdFromUrl();
        if (urlId && loaded.some((p) => p.id === urlId)) {
          setSelectedPostId(urlId);
        }
      } catch (err) {
        console.error('Failed to load blog posts:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Support browser back/forward between feed and open article
  useEffect(() => {
    const onPopState = () => {
      const urlId = readPostIdFromUrl();
      setSelectedPostId(urlId && posts.some((p) => p.id === urlId) ? urlId : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [posts]);

  const openPost = useCallback((post: Post) => {
    setSelectedPostId(post.id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('post', post.id);
      window.history.pushState({ postId: post.id }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const closePost = useCallback(() => {
    setSelectedPostId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('post');
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) {
      for (const t of p.tags || []) {
        const clean = t.trim();
        if (clean && !map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), clean);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeTag !== '__all__') {
        const hasTag = (post.tags || []).some(
          (t) => t.trim().toLowerCase() === activeTag.toLowerCase()
        );
        if (!hasTag) return false;
      }
      if (!q) return true;
      const hay = [
        post.title,
        post.subtitle,
        ...(post.tags || []),
        summarizeMarkdownExcerpt(post.content, 400),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [posts, activeTag, searchQuery]);

  const selectedIndex = useMemo(
    () => (selectedPostId ? posts.findIndex((p) => p.id === selectedPostId) : -1),
    [posts, selectedPostId]
  );
  const selectedPost = selectedIndex >= 0 ? posts[selectedIndex] : null;
  const prevPost = selectedIndex > 0 ? posts[selectedIndex - 1] : null;
  const nextPost =
    selectedIndex >= 0 && selectedIndex < posts.length - 1
      ? posts[selectedIndex + 1]
      : null;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {selectedPost ? (
          <motion.div
            key={`reader-${selectedPost.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: CALM_EASE }}
            className="w-full"
          >
            <BlogArticleReader
              post={selectedPost}
              prevPost={prevPost}
              nextPost={nextPost}
              onBack={closePost}
              onSelectPost={openPost}
            />
          </motion.div>
        ) : (
          <motion.article
            key="blog-feed"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: CALM_EASE }}
            className="w-full max-w-[780px] mx-auto px-1 sm:px-4 space-y-6 pb-12"
          >
            <div className="max-[759px]:min-h-[15vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-1">
              <div data-ascii-panel="true" className="w-fit space-y-1">
                <ScrambleHeading
                  text="Blog"
                  className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
                />
                <p className="font-sans text-xs sm:text-sm text-ink-muted">
                  Long-form notes, statistical essays, and field dispatches.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div
                data-ascii-panel="true"
                aria-busy="true"
                aria-live="polite"
                className="space-y-6"
              >
                <div className="border-t border-b border-line py-3.5 flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-ink-muted inline-flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full bg-ink-muted motion-safe:animate-pulse"
                    />
                    loading posts...
                  </span>
                </div>

                <div
                  aria-hidden="true"
                  className="divide-y divide-line border-b border-line"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="py-6 flex flex-col sm:flex-row items-start justify-between gap-5 motion-safe:animate-pulse"
                    >
                      <div className="flex-1 w-full space-y-2.5">
                        <div className="h-4 w-3/4 bg-ink/10 rounded-[1px]" />
                        <div className="h-3 w-11/12 bg-ink/5 rounded-[1px]" />
                        <div className="h-3 w-2/3 bg-ink/5 rounded-[1px]" />
                        <div className="h-2.5 w-44 bg-ink/5 rounded-[1px] pt-1" />
                      </div>
                      <div className="w-full sm:w-36 aspect-[16/10] shrink-0 border border-line/70 bg-ink/5 rounded-[2px]" />
                    </div>
                  ))}
                </div>
              </div>
            ) : posts.length === 0 ? (
              <motion.div
                data-ascii-panel="true"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: CALM_EASE }}
                className="border-t border-b border-line py-16 px-4 text-center space-y-2"
              >
                <p className="font-mono text-xs sm:text-sm text-ink">
                  No posts published yet.
                </p>
                <p className="font-sans text-xs text-ink-muted">
                  Essays and notes published from the studio will appear here.
                </p>
              </motion.div>
            ) : (
              <div data-ascii-panel="true" className="space-y-4">
                {/* Filter & Topic Bar */}
                <div className="border-t border-b border-line py-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search
                        size={13}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search essays and notes..."
                        aria-label="Search blog posts"
                        className="w-full min-h-[44px] sm:min-h-[36px] bg-surface/75 border border-line-control pl-8 pr-10 py-1.5 font-mono text-base sm:text-xs text-ink placeholder:text-ink-muted focus:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 transition-colors rounded-[2px]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] sm:min-w-[32px] sm:min-h-[32px] inline-flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <span
                      aria-live="polite"
                      aria-atomic="true"
                      className="font-mono text-[11px] text-ink-muted tabular-nums shrink-0"
                    >
                      {filteredPosts.length}{' '}
                      {filteredPosts.length === 1 ? 'post' : 'posts'}
                    </span>
                  </div>

                  {allTags.length > 0 && (
                    <div
                      role="group"
                      aria-label="Filter posts by topic"
                      className="flex items-center gap-3 overflow-x-auto pb-0.5 font-mono text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {[{ id: '__all__', label: 'All' }, ...allTags.map((t) => ({ id: t, label: t }))].map(
                        (item) => {
                          const selected =
                            activeTag.toLowerCase() === item.id.toLowerCase();
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setActiveTag(item.id)}
                              className={`shrink-0 whitespace-nowrap min-w-[32px] min-h-[40px] sm:min-h-[32px] px-1 pb-1 border-b transition-colors cursor-pointer ${
                                selected
                                  ? 'text-ink border-ink'
                                  : 'text-ink-muted border-transparent hover:text-ink'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>

                {/* Publication Feed */}
                {filteredPosts.length === 0 ? (
                  <div className="py-12 text-center space-y-2 border-b border-line">
                    <p className="font-mono text-xs text-ink">
                      No posts match this filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveTag('__all__');
                      }}
                      className="min-h-[36px] px-2 font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                    >
                      reset filters
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-line border-b border-line">
                    {filteredPosts.map((post, idx) => {
                      const coverSrc =
                        (post.imageUrl && isSafeImageSrc(post.imageUrl)
                          ? post.imageUrl
                          : undefined) || extractFirstMarkdownImage(post.content);
                      const excerpt =
                        post.subtitle || summarizeMarkdownExcerpt(post.content, 190);
                      const readMins = estimateReadingMinutes(post.content);

                      return (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.28,
                            ease: CALM_EASE,
                            delay: Math.min(idx * 0.035, 0.18),
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openPost(post)}
                            className="group w-full text-left py-6 flex flex-col sm:flex-row items-start justify-between gap-5 cursor-pointer transition-opacity duration-200 active:opacity-80"
                          >
                            <div className="flex-1 min-w-0 space-y-2">
                              {post.tags && post.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {post.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <h2 className="font-mono text-base sm:text-lg font-medium tracking-tight text-ink group-hover:underline underline-offset-4">
                                {post.title}
                              </h2>

                              {excerpt && (
                                <p className="font-sans text-sm text-ink-nav leading-relaxed line-clamp-2">
                                  {excerpt}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 font-mono text-[11px] text-ink-muted tabular-nums">
                                <span>{profileData.shortName}</span>
                                {post.createdAt && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <time dateTime={post.createdAt}>
                                      {new Date(post.createdAt).toLocaleDateString(
                                        'en-US',
                                        {
                                          year: 'numeric',
                                          month: 'short',
                                          day: '2-digit',
                                        }
                                      )}
                                    </time>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>{readMins} min read</span>
                              </div>
                            </div>

                            {coverSrc && (
                              <div className="w-full sm:w-40 aspect-[16/10] shrink-0 overflow-hidden border border-line rounded-[2px] bg-surface/70">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={coverSrc}
                                  alt=""
                                  width={160}
                                  height={100}
                                  loading={idx < 3 ? undefined : 'lazy'}
                                  decoding="async"
                                  className="w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.03]"
                                />
                              </div>
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.article>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
