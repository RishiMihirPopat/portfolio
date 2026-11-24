'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Photo } from '@/lib/data';

interface PhotoLightboxProps {
  photo: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (photo: Photo) => void;
}

let canTransitionDisplayCached: boolean | null = null;

function canTransitionDisplay(): boolean {
  if (canTransitionDisplayCached !== null) {
    return canTransitionDisplayCached;
  }
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'position: fixed; visibility: hidden; pointer-events: none; transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  try {
    void getComputedStyle(probe).display;
    probe.style.display = 'none';
    const supported = getComputedStyle(probe).display === 'block';
    canTransitionDisplayCached = supported;
    return supported;
  } finally {
    probe.remove();
  }
}

function supportsTopLayerExit(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }
  return CSS.supports('overlay', 'auto') && canTransitionDisplay();
}

function formatPhotoDate(raw?: string): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function PhotoLightbox({
  photo,
  photos,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(
    null
  );
  const isClosingRef = useRef(false);
  const closingTokenRef = useRef(0);
  const isMountedRef = useRef(true);
  const clearRafRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const [cachedPhoto, setCachedPhoto] = useState<Photo | null>(photo);
  const activePhoto = photo ?? cachedPhoto;

  const cancelPendingClear = useCallback(() => {
    if (clearRafRef.current !== null) {
      window.cancelAnimationFrame(clearRafRef.current);
      clearRafRef.current = null;
    }
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!photo) return;
    cancelPendingClear();
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setCachedPhoto(photo);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photo, cancelPendingClear]);

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImgError = Boolean(activePhoto && failedUrl === activePhoto.url);

  const activeIdx = activePhoto
    ? photos.findIndex((p) => p.id === activePhoto.id)
    : -1;
  const hasMultiple = photos.length > 1;
  const counterText =
    activeIdx >= 0 && photos.length > 0
      ? `${String(activeIdx + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`
      : null;
  const formattedDate = formatPhotoDate(activePhoto?.createdAt);

  const closeTopLayer = useCallback(async (dialog: HTMLDialogElement | null) => {
    if (!dialog || !dialog.open || isClosingRef.current) return;

    if (supportsTopLayerExit()) {
      dialog.close();
      return;
    }

    isClosingRef.current = true;
    const token = ++closingTokenRef.current;
    dialog.setAttribute('data-closing', '');

    const animations =
      typeof dialog.getAnimations === 'function'
        ? dialog.getAnimations({ subtree: true })
        : [];

    if (animations.length > 0) {
      let timerId: number | undefined;
      const timeoutPromise = new Promise<void>((resolve) => {
        timerId = window.setTimeout(resolve, 500);
      });
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        timeoutPromise,
      ]);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    }

    if (!isMountedRef.current || closingTokenRef.current !== token) {
      return;
    }

    isClosingRef.current = false;
    dialog.removeAttribute('data-closing');
    if (dialog.open) {
      dialog.close();
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const closingTokens = closingTokenRef;
    return () => {
      isMountedRef.current = false;
      closingTokens.current += 1;
      cancelPendingClear();
    };
  }, [cancelPendingClear]);

  // Sync declarative `photo` prop with native top-layer <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (photo) {
      closingTokenRef.current += 1;
      isClosingRef.current = false;
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [photo, closeTopLayer]);

  // Safari light-dismiss fallback when closedby="any" is unsupported
  const isOpen = Boolean(photo);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || 'closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        pressedOutside = false;
        return;
      }
      pressedOutside = isOutside(e);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        void closeTopLayer(dialog);
      }
      pressedOutside = false;
    };

    const onPointerCancel = () => {
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    dialog.addEventListener('pointercancel', onPointerCancel);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
      dialog.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [isOpen, closeTopLayer]);

  // Keep active thumbnail visible in horizontal filmstrip
  useEffect(() => {
    if (!photo || photos.length <= 1) return;
    const activeThumb = thumbRefs.current.get(photo.id);
    if (!activeThumb || typeof activeThumb.scrollIntoView !== 'function') return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    activeThumb.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }, [photo, photos.length]);

  const handlePrev = useCallback(() => {
    if (activeIdx === -1 || photos.length <= 1) return;
    onNavigate(photos[(activeIdx - 1 + photos.length) % photos.length]);
  }, [activeIdx, photos, onNavigate]);

  const handleNext = useCallback(() => {
    if (activeIdx === -1 || photos.length <= 1) return;
    onNavigate(photos[(activeIdx + 1) % photos.length]);
  }, [activeIdx, photos, onNavigate]);

  const handleRequestClose = useCallback(() => {
    void closeTopLayer(dialogRef.current);
  }, [closeTopLayer]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !e.currentTarget.open && !photo) {
      cancelPendingClear();
      setCachedPhoto(null);
    }
  };

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    void closeTopLayer(e.currentTarget);
  };

  const handleNativeClose = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget;
    closingTokenRef.current += 1;
    isClosingRef.current = false;
    dialog.removeAttribute('data-closing');
    dialog.returnValue = '';
    setFailedUrl(null);
    onClose();

    cancelPendingClear();
    clearRafRef.current = window.requestAnimationFrame(() => {
      clearRafRef.current = null;
      if (!isMountedRef.current || dialog.open) return;
      const hasRunningTransition =
        typeof dialog.getAnimations === 'function' &&
        dialog.getAnimations().length > 0;
      if (!hasRunningTransition) {
        setCachedPhoto(null);
      } else {
        clearTimerRef.current = window.setTimeout(() => {
          clearTimerRef.current = null;
          if (isMountedRef.current && !dialog.open) {
            setCachedPhoto(null);
          }
        }, 350);
      }
    });
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (!photo || isClosingRef.current) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'ArrowLeft') {
      if (hasMultiple) {
        e.preventDefault();
        handlePrev();
      }
    } else if (e.key === 'ArrowRight') {
      if (hasMultiple) {
        e.preventDefault();
        handleNext();
      }
    } else if (e.key === 'Home') {
      if (hasMultiple && photos[0]) {
        e.preventDefault();
        onNavigate(photos[0]);
      }
    } else if (e.key === 'End') {
      if (hasMultiple && photos[photos.length - 1]) {
        e.preventDefault();
        onNavigate(photos[photos.length - 1]);
      }
    }
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasMultiple) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    swipeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== e.pointerId || !hasMultiple) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  const handleStagePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartRef.current?.pointerId === e.pointerId) {
      swipeStartRef.current = null;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="lightbox-photo-title"
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onTransitionEnd={handleTransitionEnd}
      onKeyDown={handleDialogKeyDown}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="photo-lightbox-dialog p-0 m-auto w-[min(94dvw,64rem)] max-w-[94dvw] max-h-[92dvh] bg-bg/95 border border-line text-ink rounded-[2px] shadow-2xl overflow-hidden"
    >
      {activePhoto && (
        <div className="flex flex-col max-h-[92dvh] overflow-y-auto">
          {/* Top bar */}
          <div className="border-b border-line px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="font-mono text-xs text-ink-muted flex items-center gap-2 min-w-0">
              {counterText && <span>{counterText}</span>}
              {counterText && formattedDate && <span aria-hidden="true">·</span>}
              {formattedDate && <span>{formattedDate}</span>}
            </div>
            <button
              type="button"
              autoFocus
              onClick={handleRequestClose}
              aria-label="Close photo viewer"
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0 rounded-[2px]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Image stage */}
          <div
            onPointerDown={handleStagePointerDown}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={handleStagePointerCancel}
            style={{ touchAction: 'pan-y' }}
            className="relative flex items-center justify-center bg-surface/60 px-2 sm:px-14 py-3 min-h-[240px]"
          >
            {hasImgError ? (
              <div
                role="status"
                className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center font-mono text-xs text-ink-muted"
              >
                <span>[ image unavailable ]</span>
                <span className="text-[11px] opacity-80">
                  {activePhoto.title}
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activePhoto.url}
                alt={activePhoto.title}
                draggable={false}
                onError={() => setFailedUrl(activePhoto.url)}
                className="max-h-[58dvh] w-auto max-w-full object-contain block select-none"
              />
            )}

            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center bg-bg/75 sm:bg-bg/60 border border-line/80 text-ink-muted hover:text-ink hover:border-ink transition-colors cursor-pointer rounded-[2px]"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center bg-bg/75 sm:bg-bg/60 border border-line/80 text-ink-muted hover:text-ink hover:border-ink transition-colors cursor-pointer rounded-[2px]"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Caption block */}
          <div className="px-4 sm:px-6 py-3 border-t border-line space-y-1 shrink-0">
            <h2
              id="lightbox-photo-title"
              className="font-mono text-sm font-normal text-ink"
            >
              {activePhoto.title}
            </h2>
            {activePhoto.description && (
              <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed">
                {activePhoto.description}
              </p>
            )}
          </div>

          {/* Thumbnail strip */}
          {hasMultiple && (
            <div
              role="region"
              aria-label="Photo thumbnails"
              className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-2.5 border-t border-line snap-x shrink-0"
            >
              {photos.map((item) => {
                const isActive = activePhoto.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(el) => {
                      if (el) {
                        thumbRefs.current.set(item.id, el);
                      } else {
                        thumbRefs.current.delete(item.id);
                      }
                    }}
                    onClick={() => onNavigate(item)}
                    aria-label={item.title}
                    aria-current={isActive ? 'true' : undefined}
                    className={`w-14 h-10 shrink-0 border snap-center overflow-hidden bg-surface/80 transition-colors cursor-pointer rounded-[2px] ${
                      isActive
                        ? 'border-ink ring-1 ring-ink'
                        : 'border-line opacity-65 hover:opacity-100 hover:border-ink/70'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover block"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
