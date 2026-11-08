'use client';

import { useEffect, useState } from 'react';

const SCRAMBLE_GLYPHS = '.:-=+*#%@~';

interface ScrambleHeadingProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2';
}

export function ScrambleHeading({
  text,
  className = '',
  as: Tag = 'h1',
}: ScrambleHeadingProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 14; // ~450ms at 30fps
    const interval = setInterval(() => {
      frame++;
      if (frame >= totalFrames) {
        setDisplay(text);
        clearInterval(interval);
        return;
      }

      const progress = frame / totalFrames;
      const revealCount = Math.floor(text.length * progress);
      let nextStr = '';

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ') {
          nextStr += ' ';
        } else if (i < revealCount) {
          nextStr += ch;
        } else {
          const randIdx = (i * 7 + frame * 13) % SCRAMBLE_GLYPHS.length;
          nextStr += SCRAMBLE_GLYPHS[randIdx];
        }
      }
      setDisplay(nextStr);
    }, 32);

    return () => clearInterval(interval);
  }, [text]);

  return <Tag className={className}>{display}</Tag>;
}
