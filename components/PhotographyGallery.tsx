'use client';

import { useState } from 'react';
import { Photo } from '@/lib/data';

export type GalleryPhoto = Photo & {
  width?: number;
  height?: number;
};

interface PhotographyGalleryProps {
  photos: GalleryPhoto[];
  onSelectPhoto: (photo: GalleryPhoto) => void;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

interface GalleryCardProps {
  photo: GalleryPhoto;
  index: number;
  onSelectPhoto: (photo: GalleryPhoto) => void;
}

function GalleryCard({ photo, index, onSelectPhoto }: GalleryCardProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const width =
    typeof photo.width === 'number' && photo.width > 0 ? photo.width : undefined;
  const height =
    typeof photo.height === 'number' && photo.height > 0 ? photo.height : undefined;
  const hasDimensions = width !== undefined && height !== undefined;

  const isLoaded = loadedUrl === photo.url;
  const isUnavailable = !photo.url || failedUrl === photo.url;

  const paddedIndex = String(index + 1).padStart(2, '0');
  const formattedDate = formatShortDate(photo.createdAt);
  const metaLabel = formattedDate ? `${paddedIndex} · ${formattedDate}` : paddedIndex;
  const title = photo.title || 'Untitled';

  return (
    <li className="break-inside-avoid mb-2 p-1">
      <article className="group relative border border-line bg-surface/65 hover:border-ink/60 transition-colors rounded-[2px] overflow-hidden has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-ink has-[button:focus-visible]:outline-offset-2">
        <div
          className={`relative overflow-hidden bg-surface/80${
            !hasDimensions && !isLoaded && !isUnavailable ? ' min-h-[120px]' : ''
          }`}
        >
          {isUnavailable ? (
            <div
              className="flex min-h-[120px] w-full items-center justify-center px-3 py-6 text-center font-mono text-xs text-ink-muted"
              style={hasDimensions ? { aspectRatio: `${width} / ${height}` } : undefined}
            >
              [ image unavailable ]
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo.url}
              alt={title}
              width={hasDimensions ? width : undefined}
              height={hasDimensions ? height : undefined}
              style={hasDimensions ? { aspectRatio: `${width} / ${height}` } : undefined}
              loading={index >= 2 ? 'lazy' : undefined}
              decoding={index >= 2 ? 'async' : undefined}
              fetchPriority={index === 0 ? 'high' : undefined}
              onLoad={() => setLoadedUrl(photo.url)}
              onError={() => setFailedUrl(photo.url)}
              className="w-full h-auto block motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-[1.02]"
            />
          )}
        </div>

        <div className="border-t border-line px-3 py-2.5 flex items-baseline justify-between gap-2">
          <h2 className="font-mono text-xs sm:text-[13px] font-normal text-ink min-w-0 truncate">
            <button
              type="button"
              onClick={() => onSelectPhoto(photo)}
              className="block w-full truncate text-left after:content-[''] after:absolute after:inset-0 focus-visible:outline-none cursor-pointer"
            >
              {title}
              <span className="sr-only"> — open preview</span>
            </button>
          </h2>
          <span className="font-mono text-[11px] text-ink-muted shrink-0">
            {metaLabel}
          </span>
        </div>
      </article>
    </li>
  );
}

export function PhotographyGallery({ photos, onSelectPhoto }: PhotographyGalleryProps) {
  return (
    <div className="space-y-4">
      <div className="border-t border-line pt-3 flex items-baseline justify-between gap-4">
        <p className="font-sans text-xs sm:text-sm text-ink-muted">
          Selected frames &amp; field studies.
        </p>
        <span className="font-mono text-xs text-ink-muted shrink-0">
          {photos.length} {photos.length === 1 ? 'frame' : 'frames'}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="font-sans text-sm text-ink-muted py-6">
          No photographs archived yet.
        </p>
      ) : (
        <ul
          role="list"
          className={
            photos.length > 1
              ? 'columns-1 min-[480px]:columns-2 gap-2 -mx-1 -mt-1'
              : 'columns-1 -mx-1 -mt-1'
          }
        >
          {photos.map((photo, index) => (
            <GalleryCard
              key={photo.id}
              photo={photo}
              index={index}
              onSelectPhoto={onSelectPhoto}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
