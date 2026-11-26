'use client';

import * as React from 'react';
import { Layers, Pause, Sparkles, Waves } from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from 'motion/react';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_IDS,
  ASCII_SCENE_STORAGE_KEY,
  AsciiSceneId,
  DEFAULT_ASCII_SCENE,
  normalizeAsciiSceneId,
} from '@/components/ascii/types';
import {
  CALM_EASE,
  GLIDE_SPRING,
  TACTILE_SPRING,
} from '@/components/CollapsibleLog';

function readStoredScene(): AsciiSceneId {
  if (typeof window === 'undefined') return DEFAULT_ASCII_SCENE;
  try {
    return normalizeAsciiSceneId(
      window.localStorage.getItem(ASCII_SCENE_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_ASCII_SCENE;
  }
}

function subscribeScene(callback: () => void): () => void {
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

function subscribeEmpty(): () => void {
  return () => {};
}

function SceneIcon({ scene }: { scene: AsciiSceneId }) {
  if (scene === 'still') {
    return <Pause size={13} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (scene === 'contour') {
    return <Layers size={13} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (scene === 'caustics') {
    return <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />;
  }
  return <Waves size={13} strokeWidth={1.75} aria-hidden="true" />;
}

export interface SceneToggleProps {
  variant?: 'cycle' | 'segmented';
  className?: string;
}

export function SceneToggle({ variant = 'cycle', className = '' }: SceneToggleProps) {
  const mounted = React.useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );
  const scene = React.useSyncExternalStore(
    subscribeScene,
    readStoredScene,
    () => DEFAULT_ASCII_SCENE
  );

  const selectScene = React.useCallback((nextScene: AsciiSceneId) => {
    try {
      window.localStorage.setItem(ASCII_SCENE_STORAGE_KEY, nextScene);
    } catch {
      // Ignore storage errors in restricted browsing contexts
    }
    window.dispatchEvent(
      new CustomEvent(ASCII_SCENE_CHANGE_EVENT, {
        detail: { scene: nextScene },
      })
    );
  }, []);

  if (!mounted) {
    if (variant === 'segmented') {
      return (
        <span
          className={`inline-flex items-center gap-3 min-h-[44px] font-mono text-xs shrink-0 ${className}`}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={`inline-flex min-w-[76px] h-11 min-h-[44px] shrink-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'segmented') {
    return (
      <MotionConfig reducedMotion="user">
        <LayoutGroup id="ascii-scene-toggle">
          <div
            role="group"
            aria-label="Background preset"
            className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}
          >
            {ASCII_SCENE_IDS.map((id) => {
              const active = scene === id;
              return (
                <motion.button
                  key={id}
                  type="button"
                  onClick={() => selectScene(id)}
                  aria-pressed={active}
                  whileTap={{ scale: 0.96 }}
                  transition={TACTILE_SPRING}
                  className={`relative min-h-[44px] px-2.5 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    active ? 'text-ink' : 'text-ink-nav hover:text-ink'
                  }`}
                >
                  <SceneIcon scene={id} />
                  <span>{id}</span>
                  {active && (
                    <motion.span
                      layoutId="ascii-scene-underline"
                      transition={GLIDE_SPRING}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-2.5 bottom-[9px] h-[1px] bg-ink"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
      </MotionConfig>
    );
  }

  const currentIdx = ASCII_SCENE_IDS.indexOf(scene);
  const nextScene = ASCII_SCENE_IDS[(currentIdx + 1) % ASCII_SCENE_IDS.length];

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={() => selectScene(nextScene)}
        whileHover={{ y: -0.5 }}
        whileTap={{ scale: 0.95 }}
        transition={TACTILE_SPRING}
        className={`min-h-[44px] min-w-[76px] px-2 font-mono text-xs font-normal text-ink-nav hover:text-ink transition-colors cursor-pointer inline-flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        aria-label={`Background scene: ${scene}. Switch to ${nextScene}`}
        title={`Field: ${scene} (switch to ${nextScene})`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={scene}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16, ease: CALM_EASE }}
            className="inline-flex items-center gap-1.5"
          >
            <SceneIcon scene={scene} />
            <span>{scene}</span>
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </MotionConfig>
  );
}
