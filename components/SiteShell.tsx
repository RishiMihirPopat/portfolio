'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ALL_PAGES,
  HEADER_NAV_ITEMS,
  getAdjacentPages,
  getPageByPathname,
  normalizePathname,
} from '@/lib/navigation';
import { profileData } from '@/lib/data';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SceneToggle } from '@/components/SceneToggle';
import {
  FADE_DURATION_MS,
  NON_BEACH_FADE_OUT_MS,
  WASH_DURATION_MS,
} from '@/components/AsciiBeachCanvas';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_STORAGE_KEY,
  AsciiSceneId,
  DEFAULT_ASCII_SCENE,
} from '@/components/ascii/types';
import { useIsMobile } from '@/hooks/use-mobile';

const NON_BEACH_FADE_IN_MS = 360;

type TransitionDir = 'forward' | 'backward' | 'none';
type MenuVisualState = 'entering' | 'open' | 'closing';

function isValidSceneId(value: string | null | undefined): value is AsciiSceneId {
  return value === 'beach' || value === 'city' || value === 'room';
}

function subscribeAsciiScene(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onSceneChange = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === ASCII_SCENE_STORAGE_KEY) callback();
  };
  window.addEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ASCII_SCENE_CHANGE_EVENT, onSceneChange);
    window.removeEventListener('storage', onStorage);
  };
}

function getAsciiSceneSnapshot(): AsciiSceneId {
  if (typeof window === 'undefined') return DEFAULT_ASCII_SCENE;
  try {
    const stored = window.localStorage.getItem(ASCII_SCENE_STORAGE_KEY);
    return isValidSceneId(stored) ? stored : DEFAULT_ASCII_SCENE;
  } catch {
    return DEFAULT_ASCII_SCENE;
  }
}

function getAsciiSceneServerSnapshot(): AsciiSceneId {
  return DEFAULT_ASCII_SCENE;
}

function inferRouteDirection(fromPath: string, toPath: string): TransitionDir {
  const fromIdx = ALL_PAGES.findIndex((p) => p.href === fromPath);
  const toIdx = ALL_PAGES.findIndex((p) => p.href === toPath);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return 'none';
  return toIdx > fromIdx ? 'forward' : 'backward';
}

interface IndicatorState {
  left: number;
  width: number;
  visible: boolean;
  ready: boolean;
}

function measureUnderlineState(
  navEl: HTMLElement | null,
  pageId: string,
  showInHeader: boolean,
  isAdminRoute: boolean,
  prev: IndicatorState
): IndicatorState {
  const activeLink = navEl?.querySelector<HTMLAnchorElement>(
    `[data-nav-id="${pageId}"]`
  );
  if (!navEl || !activeLink || !showInHeader || isAdminRoute) {
    return { ...prev, visible: false };
  }

  const navRect = navEl.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  if (navRect.width <= 0 || linkRect.width <= 0) {
    return { ...prev, visible: false };
  }

  return {
    left: Math.round((linkRect.left - navRect.left) * 10) / 10,
    width: Math.round(linkRect.width * 10) / 10,
    visible: true,
    ready: prev.visible,
  };
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPath = normalizePathname(pathname);
  const isAdminRoute = normalizedPath.startsWith('/admin');

  const activeScene = useSyncExternalStore(
    subscribeAsciiScene,
    getAsciiSceneSnapshot,
    getAsciiSceneServerSnapshot
  );
  const isBeachScene = activeScene === 'beach';

  const [transitionPhase, setTransitionPhase] = useState<
    'idle' | 'washing-away' | 'swapping' | 'fading-in'
  >('idle');
  const [exitKind, setExitKind] = useState<'wave' | 'fade'>('wave');
  const [transitionDir, setTransitionDir] = useState<TransitionDir>('none');
  const targetPathRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const washTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPage = getPageByPathname(normalizedPath);
  const { prev: prevPage, next: nextPage } = getAdjacentPages(normalizedPath);

  const isCompactNav = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRendered, setMenuRendered] = useState(false);
  const [menuVisualState, setMenuVisualState] = useState<MenuVisualState>('entering');
  const menuOpenRef = useRef(false);
  const menuRenderedRef = useRef(false);
  const menuOpenRafRef = useRef<number | null>(null);
  const menuOpenRaf2Ref = useRef<number | null>(null);
  const menuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);

  const [indicator, setIndicator] = useState<IndicatorState>({
    left: 0,
    width: 0,
    visible: false,
    ready: false,
  });

  const cancelMenuAnimations = useCallback(() => {
    if (menuOpenRafRef.current !== null) {
      cancelAnimationFrame(menuOpenRafRef.current);
      menuOpenRafRef.current = null;
    }
    if (menuOpenRaf2Ref.current !== null) {
      cancelAnimationFrame(menuOpenRaf2Ref.current);
      menuOpenRaf2Ref.current = null;
    }
    if (menuCloseTimerRef.current !== null) {
      clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    cancelMenuAnimations();
    menuOpenRef.current = true;
    menuRenderedRef.current = true;
    setMenuOpen(true);
    setMenuRendered(true);
    setMenuVisualState('entering');

    menuOpenRafRef.current = requestAnimationFrame(() => {
      menuOpenRafRef.current = null;
      menuOpenRaf2Ref.current = requestAnimationFrame(() => {
        menuOpenRaf2Ref.current = null;
        setMenuVisualState('open');
      });
    });
  }, [cancelMenuAnimations]);

  const closeMenu = useCallback(
    (restoreFocus = false) => {
      cancelMenuAnimations();
      menuOpenRef.current = false;
      setMenuOpen(false);
      if (!menuRenderedRef.current) {
        return;
      }
      setMenuVisualState('closing');

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const closeDuration = prefersReduced ? 100 : 200;

      menuCloseTimerRef.current = setTimeout(() => {
        menuCloseTimerRef.current = null;
        menuRenderedRef.current = false;
        setMenuRendered(false);
        setMenuVisualState('entering');
        if (restoreFocus) {
          menuButtonRef.current?.focus();
        }
      }, closeDuration);
    },
    [cancelMenuAnimations]
  );

  // Orchestrate single wave wash-away and calm fade-in page transition
  const navigateWithWave = (
    targetHref: string,
    e?: React.MouseEvent,
    explicitDir?: TransitionDir
  ) => {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return; // allow normal new-tab / modifier clicks
      }
      e.preventDefault();
    }

    const normTarget = normalizePathname(targetHref);
    if (menuOpenRef.current || menuRenderedRef.current) {
      closeMenu(false);
    }

    if (normTarget === normalizedPath) {
      return;
    }

    const useWave = activeScene === 'beach';
    const exitDuration = useWave ? WASH_DURATION_MS : NON_BEACH_FADE_OUT_MS;
    const nextDir = useWave
      ? (explicitDir ?? inferRouteDirection(normalizedPath, normTarget))
      : 'none';
    setExitKind(useWave ? 'wave' : 'fade');
    setTransitionDir(nextDir);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      if (washTimerRef.current) clearTimeout(washTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (swapSafetyTimerRef.current) clearTimeout(swapSafetyTimerRef.current);
      isTransitioningRef.current = false;
      targetPathRef.current = null;
      router.push(targetHref);
      return;
    }

    // If already transitioning to this exact target, don't restart
    if (isTransitioningRef.current && targetPathRef.current === normTarget) {
      return;
    }

    if (washTimerRef.current) clearTimeout(washTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (swapSafetyTimerRef.current) clearTimeout(swapSafetyTimerRef.current);

    const wasWashing = isTransitioningRef.current;
    isTransitioningRef.current = true;
    targetPathRef.current = normTarget;
    setTransitionPhase('washing-away');

    // Restart CSS keyframe if user rapidly clicks a different destination mid-exit
    if (wasWashing && mainRef.current) {
      const anims =
        typeof mainRef.current.getAnimations === 'function'
          ? mainRef.current.getAnimations()
          : [];
      anims.forEach((anim) => {
        anim.currentTime = 0;
        anim.play();
      });
    }

    // Immediately glide desktop underline to the clicked nav link for responsive feedback
    const targetItem = HEADER_NAV_ITEMS.find((item) => item.href === normTarget);
    if (targetItem && desktopNavRef.current) {
      const targetEl = desktopNavRef.current.querySelector<HTMLAnchorElement>(
        `[data-nav-id="${targetItem.id}"]`
      );
      if (targetEl) {
        const navRect = desktopNavRef.current.getBoundingClientRect();
        const linkRect = targetEl.getBoundingClientRect();
        if (navRect.width > 0 && linkRect.width > 0) {
          setIndicator({
            left: Math.round((linkRect.left - navRect.left) * 10) / 10,
            width: Math.round(linkRect.width * 10) / 10,
            visible: true,
            ready: true,
          });
        }
      }
    } else {
      setIndicator((prev) => ({ ...prev, visible: false }));
    }

    // Notify ASCII canvas (ocean wave wash for beach; calm panel fade-out for city/room)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ascii-wave-wash'));
    }

    // After exitDuration (560ms beach wave / 260ms non-beach fade-out): swap route.
    washTimerRef.current = setTimeout(() => {
      washTimerRef.current = null;
      setTransitionPhase('swapping');
      router.push(targetHref);

      // Safety fallback so content never stays stuck at opacity: 0 if navigation stalls/aborts
      swapSafetyTimerRef.current = setTimeout(() => {
        swapSafetyTimerRef.current = null;
        if (!isTransitioningRef.current) return;
        isTransitioningRef.current = false;
        targetPathRef.current = null;
        setTransitionPhase('fading-in');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ascii-page-fade-in'));
        }
        const enterDuration =
          getAsciiSceneSnapshot() === 'beach' ? FADE_DURATION_MS : NON_BEACH_FADE_IN_MS;
        fadeTimerRef.current = setTimeout(() => {
          fadeTimerRef.current = null;
          setTransitionPhase('idle');
        }, enterDuration);
      }, 1400);
    }, exitDuration);
  };

  const navigateRef = useRef(navigateWithWave);
  useEffect(() => {
    navigateRef.current = navigateWithWave;
  });

  // Prefetch primary routes so transitions swap {children} immediately
  useEffect(() => {
    HEADER_NAV_ITEMS.forEach((item) => {
      router.prefetch(item.href);
    });
    router.prefetch('/');
  }, [router]);

  useEffect(() => {
    return () => {
      cancelMenuAnimations();
      if (washTimerRef.current) clearTimeout(washTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (swapSafetyTimerRef.current) clearTimeout(swapSafetyTimerRef.current);
    };
  }, [cancelMenuAnimations]);

  useEffect(() => {
    if (!isCompactNav && (menuOpenRef.current || menuRenderedRef.current)) {
      const id = requestAnimationFrame(() => closeMenu(false));
      return () => cancelAnimationFrame(id);
    }
  }, [isCompactNav, closeMenu]);

  const currentPageId = currentPage.id;
  const showInHeader = currentPage.showInHeader;

  useEffect(() => {
    const syncUnderline = () => {
      setIndicator((prev) =>
        measureUnderlineState(
          desktopNavRef.current,
          currentPageId,
          showInHeader,
          isAdminRoute,
          prev
        )
      );
    };

    const rafId = requestAnimationFrame(syncUnderline);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncUnderline);
    }

    window.addEventListener('resize', syncUnderline, { passive: true });

    const ro = new ResizeObserver(syncUnderline);
    if (headerRef.current) {
      ro.observe(headerRef.current);
    }
    if (desktopNavRef.current) {
      ro.observe(desktopNavRef.current);
      desktopNavRef.current.querySelectorAll('a').forEach((el) => {
        ro.observe(el);
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncUnderline);
      ro.disconnect();
    };
  }, [currentPageId, showInHeader, isAdminRoute, isCompactNav]);

  // When route finishes mounting (via link click OR browser back/forward):
  // cancel any in-flight wash timers, reset scroll, fade in calmly, and clear transition states
  useEffect(() => {
    if (lastPathRef.current === null) {
      lastPathRef.current = normalizedPath;
    } else if (lastPathRef.current !== normalizedPath) {
      const prevPath = lastPathRef.current;
      lastPathRef.current = normalizedPath;

      if (washTimerRef.current) {
        clearTimeout(washTimerRef.current);
        washTimerRef.current = null;
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (swapSafetyTimerRef.current) {
        clearTimeout(swapSafetyTimerRef.current);
        swapSafetyTimerRef.current = null;
      }

      const currentScene = getAsciiSceneSnapshot();
      const useWave = currentScene === 'beach';

      if (!isTransitioningRef.current) {
        // Browser back/forward or direct programmatic route change
        const dir = useWave
          ? inferRouteDirection(prevPath, normalizedPath)
          : 'none';
        requestAnimationFrame(() => setTransitionDir(dir));
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      targetPathRef.current = null;
      isTransitioningRef.current = false;

      // Notify ASCII canvas that new route has mounted and new background blur box can fade in
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ascii-page-fade-in'));
      }

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const enterDuration = useWave ? FADE_DURATION_MS : NON_BEACH_FADE_IN_MS;

      const phaseRaf = requestAnimationFrame(() => {
        if (prefersReduced) {
          setTransitionPhase('idle');
        } else {
          setTransitionPhase('fading-in');
          fadeTimerRef.current = setTimeout(() => {
            fadeTimerRef.current = null;
            setTransitionPhase('idle');
          }, enterDuration);
        }

        if (menuOpenRef.current || menuRenderedRef.current) {
          closeMenu(false);
        }
      });

      return () => cancelAnimationFrame(phaseRaf);
    }
  }, [normalizedPath, closeMenu]);

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
        if (match && match.href !== normalizedPath) {
          e.preventDefault();
          navigateRef.current(match.href);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAdminRoute, normalizedPath]);

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
        closeMenu(true);
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
  }, [menuOpen, closeMenu]);

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
          aria-current={normalizedPath === '/' ? 'page' : undefined}
          className="font-mono text-xs font-normal text-ink hover:opacity-85 active:opacity-70 transition-opacity min-h-[44px] inline-flex items-center shrink-0"
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
                  data-nav-id={item.id}
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

            {/* Sliding 1px active underline (220ms ease-out, respects prefers-reduced-motion) */}
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

          <div className="ml-2 flex items-center gap-0.5">
            <SceneToggle variant="cycle" />
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile / Compact Header Controls (< 760px) */}
        <div
          className={`${
            isCompactNav ? 'flex' : 'flex min-[760px]:hidden'
          } items-center gap-0.5`}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => (menuOpen ? closeMenu(true) : openMenu())}
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-menu"
            aria-haspopup="true"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="min-h-[44px] min-w-[44px] px-2.5 font-mono text-xs font-normal text-ink hover:opacity-85 active:scale-[0.96] active:opacity-70 transition-[opacity,transform] duration-150 cursor-pointer inline-flex items-center justify-center"
          >
            {menuOpen ? 'close' : 'menu'}
          </button>
          <SceneToggle variant="cycle" />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Full-Width Menu Overlay over dimmed scene */}
      {menuRendered && (
        <div
          ref={mobileOverlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          data-state={menuVisualState}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeMenu(true);
            }
          }}
          className="mobile-menu-overlay fixed inset-0 z-40 bg-bg/92 backdrop-blur-md flex flex-col px-4 sm:px-10 py-3"
        >
          <div className="mobile-menu-header flex items-center justify-between gap-4 w-full shrink-0">
            <Link
              href="/"
              aria-current={normalizedPath === '/' ? 'page' : undefined}
              onClick={(e) => navigateWithWave('/', e)}
              className="font-mono text-xs font-normal text-ink active:opacity-70 transition-opacity min-h-[44px] inline-flex items-center"
            >
              Rishi Popat
            </Link>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => closeMenu(true)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] px-2.5 font-mono text-xs font-normal text-ink active:scale-[0.96] active:opacity-70 transition-[opacity,transform] duration-150 cursor-pointer inline-flex items-center justify-center"
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
            {HEADER_NAV_ITEMS.map((item, idx) => {
              const isActive = currentPage.id === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(e) => navigateWithWave(item.href, e)}
                  style={{ '--item-index': idx } as React.CSSProperties}
                  className={`mobile-menu-item min-h-[48px] w-full flex items-center justify-between py-2.5 font-normal active:opacity-70 ${
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
                  {isActive && (
                    <span aria-hidden="true" className="font-mono text-xs text-ink-muted">
                      ·
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quiet scene selector inside the mobile drawer */}
          <div className="mobile-menu-scene-row mt-4 flex items-center justify-between gap-4 border-b border-line pb-3">
            <span className="font-mono text-xs text-ink-muted">scene</span>
            <SceneToggle variant="segmented" />
          </div>

          {/* Tapping the remaining dimmed area below the menu list closes the menu */}
          <div
            className="flex-1 w-full cursor-pointer"
            onClick={() => closeMenu(true)}
          />
        </div>
      )}

      {/* Main Content Landmark — ocean wave wash for beach; calm fade-out/in for city & room */}
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        data-scene={activeScene}
        data-transition-dir={isBeachScene ? transitionDir : 'none'}
        className={`flex-1 flex flex-col justify-start pt-4 sm:pt-12 pb-10 w-full min-h-[calc(100lvh-140px)] focus:outline-none ${
          transitionPhase === 'washing-away'
            ? exitKind === 'wave'
              ? 'wave-wash-away'
              : 'calm-fade-out'
            : transitionPhase === 'swapping'
            ? 'page-swapping'
            : transitionPhase === 'fading-in'
            ? 'calm-fade-in'
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
            onClick={(e) => navigateWithWave(prevPage.href, e, 'backward')}
            aria-label={`Previous page: ${prevPage.label}`}
            className="quiet-link min-h-[44px] inline-flex items-center gap-1.5 active:scale-[0.97] active:opacity-70 transition-[color,opacity,transform] duration-150"
          >
            <span aria-hidden="true">←</span>
            <span>{prevPage.label.toLowerCase()}</span>
          </Link>
          <Link
            href={nextPage.href}
            onClick={(e) => navigateWithWave(nextPage.href, e, 'forward')}
            aria-label={`Next page: ${nextPage.label}`}
            className="quiet-link min-h-[44px] inline-flex items-center gap-1.5 active:scale-[0.97] active:opacity-70 transition-[color,opacity,transform] duration-150"
          >
            <span>{nextPage.label.toLowerCase()}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </footer>
    </div>
  );
}
