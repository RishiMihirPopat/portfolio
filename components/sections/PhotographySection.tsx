'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Photo, PhotoCollection } from '@/lib/data';
import { fetchAllCollections, fetchAllPhotos } from '@/lib/storage';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const PhotographyGallery = dynamic(
  () =>
    import('@/components/PhotographyGallery').then(
      (mod) => mod.PhotographyGallery
    ),
  { ssr: false }
);

function getPhotoTimestamp(photo: Photo): number {
  if (!photo.createdAt) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(photo.createdAt);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

export function PhotographySection() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoCollections, setPhotoCollections] = useState<PhotoCollection[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedPhotos, loadedCollections] = await Promise.all([
          fetchAllPhotos(),
          fetchAllCollections(),
        ]);
        if (!active) return;
        setPhotos(loadedPhotos);
        setPhotoCollections(loadedCollections);
      } finally {
        if (active) {
          setIsLoadingPhotos(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const ta = getPhotoTimestamp(a);
      const tb = getPhotoTimestamp(b);
      if (tb !== ta) return tb > ta ? 1 : -1;
      return 0;
    });
  }, [photos]);

  return (
    <article className="w-full">
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4 w-full max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-10">
        <div data-ascii-panel="true" className="w-fit">
          <ScrambleHeading
            text="Photography"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      <div className="section-content-reveal w-full space-y-4 sm:space-y-5">
        <PhotographyGallery
          photos={sortedPhotos}
          collectionConfigs={photoCollections}
          isLoading={isLoadingPhotos}
        />
      </div>
    </article>
  );
}
