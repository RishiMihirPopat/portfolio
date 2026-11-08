'use client';

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
  return <Tag className={className}>{text}</Tag>;
}
