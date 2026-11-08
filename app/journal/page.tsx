'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-8 md:px-12 py-6 sm:py-10 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-line">
        <Link
          href="/#blog"
          className="font-mono text-xs text-ink-muted hover:text-ink flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Portfolio</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="my-auto py-10 sm:py-14">
        <article data-ascii-panel="true" className="quiet-panel p-6 sm:p-10 space-y-8">
          <div className="space-y-1.5 border-b border-line pb-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-muted flex justify-between">
              <span>Blog</span>
              <span>{posts.length} notes</span>
            </div>
            <ScrambleHeading
              text="Blog & Notes"
              className="text-2xl sm:text-3xl font-medium tracking-tight text-ink font-mono"
            />
          </div>

          <div className="divide-y divide-line">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="py-5 first:pt-0 last:pb-0 group cursor-pointer space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <h2 className="text-base font-medium text-ink group-hover:underline underline-offset-4">
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
                <p className="text-sm text-ink-muted line-clamp-3 leading-relaxed">
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
