'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

type ModalVisualState = 'entering' | 'open' | 'closing';

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const titleId = useId();
  const [rendered, setRendered] = useState(false);
  const [visualState, setVisualState] = useState<ModalVisualState>('entering');
  const [snapshot, setSnapshot] = useState<{
    title: string;
    children: React.ReactNode;
  }>({ title, children });

  const renderedRef = useRef(false);
  const isClosingRef = useRef(false);
  const openRaf1Ref = useRef<number | null>(null);
  const openRaf2Ref = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const cancelTimers = useCallback(() => {
    if (openRaf1Ref.current !== null) {
      cancelAnimationFrame(openRaf1Ref.current);
      openRaf1Ref.current = null;
    }
    if (openRaf2Ref.current !== null) {
      cancelAnimationFrame(openRaf2Ref.current);
      openRaf2Ref.current = null;
    }
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const startExit = useCallback(
    (notifyParent: boolean) => {
      if (!renderedRef.current || isClosingRef.current) return;
      cancelTimers();
      isClosingRef.current = true;
      setVisualState('closing');

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const closeDuration = prefersReduced ? 95 : 190;

      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        isClosingRef.current = false;
        renderedRef.current = false;
        setRendered(false);
        setVisualState('entering');

        const prevEl = previousFocusRef.current;
        previousFocusRef.current = null;
        if (prevEl && typeof prevEl.focus === 'function' && prevEl.isConnected) {
          prevEl.focus();
        }

        if (notifyParent) {
          onCloseRef.current();
        }
      }, closeDuration);
    },
    [cancelTimers]
  );

  const handleRequestClose = useCallback(() => {
    startExit(true);
  }, [startExit]);

  useEffect(() => {
    let cancelled = false;

    if (isOpen) {
      const wasClosedOrClosing = !renderedRef.current || isClosingRef.current;
      cancelTimers();
      isClosingRef.current = false;

      if (!renderedRef.current && typeof document !== 'undefined') {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }

      renderedRef.current = true;

      queueMicrotask(() => {
        if (cancelled) return;
        setSnapshot({ title, children });
        setRendered(true);

        if (wasClosedOrClosing) {
          setVisualState('entering');
          openRaf1Ref.current = requestAnimationFrame(() => {
            openRaf1Ref.current = null;
            openRaf2Ref.current = requestAnimationFrame(() => {
              openRaf2Ref.current = null;
              if (!cancelled) {
                setVisualState('open');
              }
            });
          });
        }
      });
    } else if (renderedRef.current && !isClosingRef.current) {
      queueMicrotask(() => {
        if (!cancelled) {
          startExit(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, title, children, cancelTimers, startExit]);

  useEffect(() => {
    return () => {
      cancelTimers();
    };
  }, [cancelTimers]);

  // Body scroll lock, initial focus, Escape key, and Tab focus trap
  useEffect(() => {
    if (!rendered) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusRaf = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !panel.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          document.activeElement === last ||
          !panel.contains(document.activeElement)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(focusRaf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rendered, handleRequestClose]);

  if (!rendered) return null;

  const displayTitle = isOpen ? title : snapshot.title;
  const displayChildren = isOpen && children ? children : snapshot.children;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-state={visualState}
      className="quiet-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        onClick={handleRequestClose}
        className="quiet-modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        className="quiet-modal-panel relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-bg/95 border border-line rounded-[2px] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-line shrink-0">
          <h2
            id={titleId}
            className="font-mono text-xs uppercase tracking-wider text-ink-muted truncate pr-4"
          >
            {displayTitle}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleRequestClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2 inline-flex items-center justify-center text-ink-muted hover:text-ink active:scale-[0.96] transition-[color,transform] duration-150 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 sm:p-8 overflow-y-auto overscroll-contain text-ink text-sm leading-relaxed">
          {displayChildren}
        </div>
      </div>
    </div>
  );
}
