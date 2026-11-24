'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

function subscribeEmpty(): () => void {
  return () => {};
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );

  if (!mounted) {
    return <span className="inline-flex w-11 h-11 min-w-[44px] min-h-[44px] shrink-0" />;
  }

  const isLight = resolvedTheme === 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-2 text-ink-nav hover:text-ink transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
    </button>
  );
}
