'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { mockPosts, type Post } from '@/lib/data';
import { fetchAllPosts } from '@/lib/storage';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const PostDetailsModal = dynamic(
  () =>
    import('@/components/PostDetailsModal').then((mod) => mod.PostDetailsModal),
  { ssr: false }
);

function summarizePostContent(raw: string): string {
  const firstParagraph = raw
    .replace(/[#*`]/g, '')
    .split(/\n\s*\n/)[0]
    ?.trim();
  return firstParagraph || raw.replace(/[#*`]/g, '').slice(0, 180);
}

export function BlogSection() {
  const [posts, setPosts] = useState<Post[]>(() => mockPosts);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    let active = true;
    fetchAllPosts()
      .then((loaded) => {
        if (active) setPosts(loaded);
      })
      .catch((err) => {
        console.error('Failed to load blog posts:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <article
      data-ascii-panel="true"
      className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
    >
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div className="w-fit">
          <ScrambleHeading
            text="Blog"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      <div className="section-content-reveal w-full space-y-4 sm:space-y-5">
        <div className="divide-y divide-line border-t border-line">
          {posts.length === 0 ? (
            <p className="font-sans text-sm text-ink-muted py-6">
              No notes published yet.
            </p>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPost(post)}
                className="w-full text-left py-4 group cursor-pointer space-y-1 transition-opacity duration-150 active:opacity-75"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-mono text-sm sm:text-base font-normal text-ink group-hover:underline underline-offset-4">
                    {post.title}
                  </h2>
                  {post.createdAt && (
                    <time
                      dateTime={post.createdAt}
                      className="font-mono text-xs text-ink-muted shrink-0 tabular-nums"
                    >
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </time>
                  )}
                </div>
                <p className="font-sans text-sm text-ink-muted leading-relaxed">
                  {summarizePostContent(post.content)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedPost && (
        <PostDetailsModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </article>
  );
}
