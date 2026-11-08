'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Post } from '@/lib/data';
import { fetchAllPosts } from '@/lib/storage';
import { PostDetailsModal } from '@/components/PostDetailsModal';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function JournalPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ascii-section-change', { detail: 'blog' }));
    fetchAllPosts().then(setPosts);
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between px-5 sm:px-10 md:px-14 py-6 sm:py-8 w-full">
      <header className="flex items-center justify-between gap-4 w-full">
        <Link
          href="/#blog"
          className="font-mono text-xs text-ink hover:opacity-80 transition-opacity"
        >
          ← Rishi Popat
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col justify-start pt-12 sm:pt-16 pb-16 w-full">
        <article data-ascii-panel="true" className="w-full max-w-[560px] space-y-6">
          <ScrambleHeading
            text="Blog"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />

          <div className="divide-y divide-line border-t border-line">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="py-5 group cursor-pointer space-y-1.5"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-mono text-sm sm:text-base font-medium text-ink group-hover:underline underline-offset-4">
                    {post.title}
                  </h2>
                  {post.createdAt && (
                    <span className="font-mono text-xs text-ink-muted shrink-0">
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="font-sans text-sm text-ink-muted line-clamp-2 leading-relaxed">
                  {post.content.replace(/[#*`]/g, '')}
                </p>
              </div>
            ))}
          </div>
        </article>
      </main>

      <PostDetailsModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}
