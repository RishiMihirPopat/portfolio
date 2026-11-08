'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Photo } from '@/lib/data';

interface PhotoLightboxProps {
  photo: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (photo: Photo) => void;
}

export function PhotoLightbox({ photo, photos, onClose, onNavigate }: PhotoLightboxProps) {
  const idx = photo ? photos.findIndex((p) => p.id === photo.id) : -1;

  const handlePrev = () => {
    if (idx === -1 || photos.length === 0) return;
    onNavigate(photos[(idx - 1 + photos.length) % photos.length]);
  };

  const handleNext = () => {
    if (idx === -1 || photos.length === 0) return;
    onNavigate(photos[(idx + 1) % photos.length]);
  };

  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, idx]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 select-none">
      <button
        onClick={onClose}
        className="fixed top-6 right-6 p-2 text-neutral-400 hover:text-white transition-colors z-50 cursor-pointer"
        aria-label="Close viewer"
      >
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-white transition-colors z-50 cursor-pointer"
            aria-label="Previous photo"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={handleNext}
            className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-white transition-colors z-50 cursor-pointer"
            aria-label="Next photo"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div className="max-w-4xl w-full flex flex-col items-center gap-4">
        <div className="relative overflow-hidden border border-white/15 bg-neutral-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.title}
            className="max-h-[72vh] w-auto object-contain block"
          />
        </div>
        <div className="w-full max-w-xl text-center space-y-1 font-mono text-xs text-neutral-300">
          <div className="text-white font-sans text-sm">{photo.title}</div>
          {photo.description && (
            <p className="text-neutral-400 font-sans text-xs">{photo.description}</p>
          )}
          <div className="text-[11px] text-neutral-500 pt-1">
            {idx + 1} / {photos.length}
            {photo.createdAt ? ` · ${new Date(photo.createdAt).toLocaleDateString()}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
