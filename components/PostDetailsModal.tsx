'use client';

import ReactMarkdown from 'react-markdown';
import { Post } from '@/lib/data';
import { Modal } from '@/components/ui/Modal';
import { extractDataImages, createImgRenderer } from '@/lib/markdown';

interface PostDetailsModalProps {
  post: Post | null;
  onClose: () => void;
}

export function PostDetailsModal({ post, onClose }: PostDetailsModalProps) {
  return (
    <Modal
      isOpen={!!post}
      onClose={onClose}
      title={post ? post.title : 'Note'}
    >
      {post && (
        <div className="space-y-5 text-ink">
          <div className="space-y-1 pb-4 border-b border-line">
            <h2 className="text-lg font-medium text-ink">{post.title}</h2>
            {post.createdAt && (
              <div className="font-mono text-xs text-ink-muted">
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>

          {(() => {
            const { processed, images } = extractDataImages(post.content);
            return (
              <div className="prose prose-sm prose-neutral max-w-none font-sans prose-headings:font-medium prose-headings:text-ink prose-p:text-ink/90 prose-p:leading-relaxed prose-li:text-ink/90 prose-code:font-mono prose-code:text-xs dark:prose-invert">
                <ReactMarkdown components={{ img: createImgRenderer(images) }}>
                  {processed}
                </ReactMarkdown>
              </div>
            );
          })()}
        </div>
      )}
    </Modal>
  );
}
