'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-16 h-7" />;
  }

  const isLight = resolvedTheme === 'light';

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="quiet-btn py-1 px-2.5 text-[11px] text-ink-muted hover:text-ink"
      aria-label="Toggle color theme"
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {isLight ? <Moon size={13} /> : <Sun size={13} />}
      <span>{isLight ? 'dark' : 'light'}</span>
    </button>
  );
}
