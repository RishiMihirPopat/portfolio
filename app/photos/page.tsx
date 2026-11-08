'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
    <div className="min-h-screen flex flex-col justify-between px-5 sm:px-10 md:px-14 py-6 sm:py-8 w-full">
      <header className="flex items-center justify-between gap-4 w-full">
        <Link
          href="/#photography"
          className="font-mono text-xs text-ink hover:opacity-80 transition-opacity"
        >
          ← Rishi Popat
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col justify-start pt-12 sm:pt-16 pb-16 w-full">
        <article data-ascii-panel="true" className="w-full max-w-[560px] space-y-6">
          <ScrambleHeading
            text="Photography"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />

          <div className="divide-y divide-line border-t border-line">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="py-4 group cursor-pointer space-y-1"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-mono text-sm font-medium text-ink group-hover:underline underline-offset-4">
                    {photo.title}
                  </h2>
                  <span className="font-mono text-xs text-ink-muted shrink-0">
                    {photo.createdAt
                      ? new Date(photo.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                        })
                      : ''}{' '}
                    ↗
                  </span>
                </div>
                {photo.description && (
                  <p className="font-sans text-sm text-ink-muted leading-relaxed">
                    {photo.description}
                  </p>
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
