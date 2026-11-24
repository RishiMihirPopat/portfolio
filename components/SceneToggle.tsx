'use client';

import * as React from 'react';
import { Building2, LampDesk, Waves } from 'lucide-react';
import {
  ASCII_SCENE_CHANGE_EVENT,
  ASCII_SCENE_IDS,
  ASCII_SCENE_STORAGE_KEY,
  AsciiSceneId,
  DEFAULT_ASCII_SCENE,
} from '@/components/ascii/types';

function isValidSceneId(value: string | null): value is AsciiSceneId {
  return value === 'beach' || value === 'city' || value === 'room';
}

function readStoredScene(): AsciiSceneId {
  if (typeof window === 'undefined') return DEFAULT_ASCII_SCENE;
  try {
    const stored = window.localStorage.getItem(ASCII_SCENE_STORAGE_KEY);
    return isValidSceneId(stored) ? stored : DEFAULT_ASCII_SCENE;
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
  if (scene === 'city') {
    return <Building2 size={13} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (scene === 'room') {
    return <LampDesk size={13} strokeWidth={1.75} aria-hidden="true" />;
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
        className={`inline-flex min-w-[68px] h-11 min-h-[44px] shrink-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Background scene"
        className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}
      >
        {ASCII_SCENE_IDS.map((id) => {
          const active = scene === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectScene(id)}
              aria-pressed={active}
              className={`min-h-[44px] px-2.5 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                active
                  ? 'text-ink underline underline-offset-4 decoration-1'
                  : 'text-ink-nav hover:text-ink'
              }`}
            >
              <SceneIcon scene={id} />
              <span>{id}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const currentIdx = ASCII_SCENE_IDS.indexOf(scene);
  const nextScene = ASCII_SCENE_IDS[(currentIdx + 1) % ASCII_SCENE_IDS.length];

  return (
    <button
      type="button"
      onClick={() => selectScene(nextScene)}
      className={`min-h-[44px] min-w-[44px] px-2 font-mono text-xs font-normal text-ink-nav hover:text-ink transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${className}`}
      aria-label={`Background scene: ${scene}. Switch to ${nextScene}`}
      title={`Scene: ${scene} (switch to ${nextScene})`}
    >
      <SceneIcon scene={scene} />
      <span>{scene}</span>
    </button>
  );
}
