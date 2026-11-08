'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  HEADER_NAV_ITEMS,
  getAdjacentPages,
  getPageByPathname,
  normalizePathname,
} from '@/lib/navigation';
import { profileData } from '@/lib/data';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WASH_SURGE_MS, WASH_REVEAL_MS } from '@/components/AsciiBeachCanvas';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPath = normalizePathname(pathname);
  const isAdminRoute = normalizedPath.startsWith('/admin');

  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [washPhase, setWashPhase] = useState<'idle' | 'washing-out' | 'revealing-in'>('idle');
  const washTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePath = pendingPath || normalizedPath;
  const currentPage = getPageByPathname(effectivePath);
  const { prev: prevPage, next: nextPage } = getAdjacentPages(effectivePath);

  const [isCompactNav, setIsCompactNav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);

  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    visible: boolean;
    ready: boolean;
  }>({
    left: 0,
    width: 0,
    visible: false,
    ready: false,
  });

  // Orchestrate the Big Wave Wash page transition
  const navigateWithWave = useCallback(
    (targetHref: string, e?: React.MouseEvent) => {
      if (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return; // allow normal new-tab / modifier clicks
        }
        e.preventDefault();
      }

      const normTarget = normalizePathname(targetHref);
      setMenuOpen(false);

      if (normTarget === normalizedPath && !pendingPath) {
        return;
      }

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        router.push(targetHref);
        return;
      }

      if (washTimerRef.current) clearTimeout(washTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);

      setPendingPath(normTarget);
      setWashPhase('washing-out');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ascii-wave-wash'));
      }

      // Swap route right when the big ASCII wave crest blankets the content column.
      // Keep washPhase === 'washing-out' (100% clipped) until normalizedPath updates
      // to the new route so the old page never flashes back while Next.js swaps {children}.
      washTimerRef.current = setTimeout(() => {
        router.push(targetHref);
      }, WASH_SURGE_MS);
    },
    [normalizedPath, pendingPath, router]
  );

  // Prefetch primary routes so wave transitions swap {children} immediately at peak crest
  useEffect(() => {
    HEADER_NAV_ITEMS.forEach((item) => {
      router.prefetch(item.href);
    });
    router.prefetch('/');
  }, [router]);

  useEffect(() => {
    return () => {
      if (washTimerRef.current) clearTimeout(washTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Recompute desktop sliding underline position and width
  const updateUnderline = useCallback(() => {
    const navEl = desktopNavRef.current;
    const activeLink = linkRefs.current[currentPage.id];
    if (!navEl || !activeLink || !currentPage.showInHeader) {
      setIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }

    const navRect = navEl.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    if (navRect.width <= 0 || linkRect.width <= 0) {
      setIndicator((prev) => ({ ...prev, visible: false }));
      return;
    }

    const left = Math.round((linkRect.left - navRect.left) * 10) / 10;
    const width = Math.round(linkRect.width * 10) / 10;

    setIndicator((prev) => ({
      left,
      width,
      visible: true,
      ready: prev.visible,
    }));
  }, [currentPage.id, currentPage.showInHeader]);

  const evaluateNavFit = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsCompactNav(window.innerWidth < 760);
  }, []);

  useEffect(() => {
    evaluateNavFit();
    updateUnderline();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        evaluateNavFit();
        updateUnderline();
      });
    }

    const onResize = () => {
      evaluateNavFit();
      updateUnderline();
    };
    window.addEventListener('resize', onResize, { passive: true });

    const ro = new ResizeObserver(() => {
      updateUnderline();
    });
    if (desktopNavRef.current) {
      ro.observe(desktopNavRef.current);
    }
    Object.values(linkRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [evaluateNavFit, updateUnderline, isCompactNav]);

  // Trigger top-to-bottom reveal as soon as the new route's {children} has mounted
  useEffect(() => {
    if (pendingPath && pendingPath === normalizedPath) {
      setPendingPath(null);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
        window.dispatchEvent(new CustomEvent('ascii-wave-reveal'));
      }
      setWashPhase('revealing-in');
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => {
        setWashPhase('idle');
      }, WASH_REVEAL_MS);
    }
    setMenuOpen(false);
    const id = requestAnimationFrame(() => updateUnderline());
    return () => cancelAnimationFrame(id);
  }, [normalizedPath, pendingPath, updateUnderline]);

  // Keyboard shortcuts 1–4 to navigate to the header pages with wave wash
  useEffect(() => {
    if (isAdminRoute) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key >= '1' && e.key <= '6') {
        const match = HEADER_NAV_ITEMS.find((item) => item.shortcut === e.key);
        if (match && match.href !== effectivePath) {
          e.preventDefault();
          navigateWithWave(match.href);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAdminRoute, effectivePath, navigateWithWave]);

  // Mobile menu Escape handling, body scroll lock, and Focus Trap
  useEffect(() => {
    if (!menuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = requestAnimationFrame(() => {
      const container = mobileOverlayRef.current;
      if (!container) return;
      const firstLink = container.querySelector<HTMLElement>('nav a');
      firstLink?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        const container = mobileOverlayRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100lvh] flex flex-col justify-between px-4 sm:px-10 md:px-14 py-3 sm:py-6 w-full max-w-[100vw] overflow-x-hidden">
      {/* Skip to content link: first focusable element */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Header on one row: Name left, nav links right at desktop, menu button below 760px */}
      <header
        ref={headerRef}
        data-ascii-header="true"
        className="flex items-center justify-between gap-4 w-full whitespace-nowrap relative z-30"
      >
        <Link
          href="/"
          onClick={(e) => navigateWithWave('/', e)}
          aria-current={currentPage.id === 'home' ? 'page' : undefined}
          className="font-mono text-xs font-normal text-ink hover:opacity-85 transition-opacity min-h-[44px] inline-flex items-center shrink-0"
        >
          Rishi Popat
        </Link>

        {/* Desktop Navigation Row (>= 760px) */}
        <div
          className={`${
            isCompactNav ? 'hidden' : 'hidden min-[760px]:flex'
          } items-center gap-3 min-w-0`}
        >
          <nav
            ref={desktopNavRef}
            aria-label="Primary"
            className="relative flex items-center font-mono text-xs"
          >
            {HEADER_NAV_ITEMS.map((item, idx) => {
              const isActive = currentPage.id === item.id;
              const prevGroup = idx > 0 ? HEADER_NAV_ITEMS[idx - 1].group : item.group;
              const isNewGroup = idx > 0 && item.group !== prevGroup;

              return (
                <Link
                  key={item.id}
                  ref={(el) => {
                    linkRefs.current[item.id] = el;
                  }}
                  href={item.href}
                  onClick={(e) => navigateWithWave(item.href, e)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[44px] inline-flex items-center font-normal shrink-0 ${
                    idx === 0 ? '' : isNewGroup ? 'ml-6 lg:ml-8' : 'ml-3.5 lg:ml-4'
                  } ${item.isCta ? 'nav-cta-link' : 'quiet-link'}`}
                >
                  {item.isCta ? `${item.label} ↓` : item.label}
                </Link>
              );
            })}

            {/* Sliding 1px active underline (200ms ease-out, respects prefers-reduced-motion) */}
            <span
              aria-hidden="true"
              style={{
                transform: `translate3d(${indicator.left}px, 0, 0)`,
                width: `${indicator.width}px`,
                opacity: indicator.visible ? 1 : 0,
                transitionProperty: indicator.ready
                  ? 'transform, width, opacity'
                  : 'opacity',
              }}
              className="nav-underline-indicator pointer-events-none absolute bottom-[9px] left-0 h-[1px] bg-ink"
            />
          </nav>

          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile / Compact Header Controls (< 760px) */}
        <div
          className={`${
            isCompactNav ? 'flex' : 'flex min-[760px]:hidden'
          } items-center gap-1`}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-menu"
            aria-haspopup="true"
            className="min-h-[44px] min-w-[44px] px-2.5 font-mono text-xs font-normal text-ink hover:opacity-85 transition-opacity cursor-pointer inline-flex items-center justify-center"
          >
            {menuOpen ? 'close' : 'menu'}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Full-Width Menu Overlay over dimmed scene */}
      {menuOpen && (
        <div
          ref={mobileOverlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }
          }}
          className="fixed inset-0 z-40 bg-bg/92 backdrop-blur-md flex flex-col px-4 sm:px-10 py-3"
        >
          <div className="flex items-center justify-between gap-4 w-full shrink-0">
            <Link
              href="/"
              aria-current={currentPage.id === 'home' ? 'page' : undefined}
              onClick={(e) => navigateWithWave('/', e)}
              className="font-mono text-xs font-normal text-ink min-h-[44px] inline-flex items-center"
            >
              Rishi Popat
            </Link>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  menuButtonRef.current?.focus();
                }}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] px-2.5 font-mono text-xs font-normal text-ink cursor-pointer inline-flex items-center justify-center"
              >
                close
              </button>
              <ThemeToggle />
            </div>
          </div>

          <nav
            id="mobile-primary-menu"
            aria-label="Primary"
            className="mt-4 flex flex-col divide-y divide-line border-t border-b border-line font-mono text-sm"
          >
            {HEADER_NAV_ITEMS.map((item) => {
              const isActive = currentPage.id === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(e) => navigateWithWave(item.href, e)}
                  className={`min-h-[48px] w-full flex items-center justify-between py-2.5 font-normal ${
                    item.isCta ? 'text-ink' : isActive ? 'text-ink' : 'text-ink-nav'
                  }`}
                >
                  <span
                    className={
                      isActive ? 'underline underline-offset-4 decoration-1' : undefined
                    }
                  >
                    {item.isCta ? `${item.label} ↓` : item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Tapping the remaining dimmed area below the menu list closes the menu */}
          <div
            className="flex-1 w-full cursor-pointer"
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
          />
        </div>
      )}

      {/* Main Content Landmark — washed out and revealed in sync with the big ASCII wave */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 flex flex-col justify-start pt-4 sm:pt-12 pb-10 w-full focus:outline-none page-wave-content ${
          washPhase === 'washing-out'
            ? 'page-wave-washing-out'
            : washPhase === 'revealing-in'
            ? 'page-wave-revealing-in'
            : ''
        }`}
      >
        {children}
      </main>

      {/* Quiet Footer: email & github left; previous & next page links on phone only */}
      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-xs text-ink-nav w-full relative z-20">
        <div
          data-ascii-footer="true"
          className="flex items-center gap-5 w-fit py-0.5"
        >
          <a
            href={`mailto:${profileData.email}`}
            className="quiet-link max-[759px]:min-h-[44px] inline-flex items-center"
          >
            email
          </a>
          <a
            href={profileData.github}
            target="_blank"
            rel="noopener noreferrer"
            className="quiet-link max-[759px]:min-h-[44px] inline-flex items-center"
          >
            github
          </a>
        </div>

        <nav
          data-ascii-footer="true"
          aria-label="Page sequence"
          className={`${
            isCompactNav ? 'flex' : 'flex min-[760px]:hidden'
          } items-center gap-5 ml-auto w-fit py-0.5`}
        >
          <Link
            href={prevPage.href}
            onClick={(e) => navigateWithWave(prevPage.href, e)}
            aria-label={`Previous page: ${prevPage.label}`}
            className="quiet-link min-h-[44px] inline-flex items-center gap-1.5"
          >
            <span aria-hidden="true">←</span>
            <span>{prevPage.label.toLowerCase()}</span>
          </Link>
          <Link
            href={nextPage.href}
            onClick={(e) => navigateWithWave(nextPage.href, e)}
            aria-label={`Next page: ${nextPage.label}`}
            className="quiet-link min-h-[44px] inline-flex items-center gap-1.5"
          >
            <span>{nextPage.label.toLowerCase()}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </footer>
    </div>
  );
}
