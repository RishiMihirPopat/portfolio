'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Photo } from '@/lib/data';
import { fetchAllPhotos } from '@/lib/storage';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ascii-section-change', { detail: 'photography' }));
    fetchAllPhotos().then(setPhotos);
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-8 md:px-12 py-6 sm:py-10 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between gap-4 pb-6 border-b border-line">
        <Link
          href="/#photography"
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
              <span>Photography</span>
              <span>{photos.length} frames</span>
            </div>
            <ScrambleHeading
              text="Photography"
              className="text-2xl sm:text-3xl font-medium tracking-tight text-ink font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="group cursor-pointer space-y-2"
              >
                <div className="overflow-hidden rounded border border-line bg-black/20 aspect-[3/2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.title}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                  />
                </div>
                <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                  <span className="text-ink font-sans font-medium truncate">
                    {photo.title}
                  </span>
                  <span className="text-ink-muted text-[11px] shrink-0">
                    {photo.createdAt
                      ? new Date(photo.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                        })
                      : ''}
                  </span>
                </div>
                {photo.description && (
                  <p className="text-xs text-ink-muted line-clamp-1">{photo.description}</p>
                )}
              </div>
            ))}
          </div>
        </article>
      </main>

      <PhotoLightbox
        photo={selectedPhoto}
        photos={photos}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
      />
    </div>
  );
}
