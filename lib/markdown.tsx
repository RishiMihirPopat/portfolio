import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';

const SAFE_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i;

export function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (SAFE_DATA_IMAGE_RE.test(trimmed)) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafeLinkHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:'
    );
  } catch {
    return false;
  }
}

/**
 * Extracts validated raster data URLs from markdown image tags and replaces them
 * with short placeholders. ReactMarkdown chokes on very long data URLs in image
 * syntax, so we pull them out before parsing and resolve them in a custom img component.
 * Non-raster or scriptable data URIs (such as data:image/svg+xml) are rejected.
 */
export function extractDataImages(content: string) {
  const images: Record<string, string> = {};
  let counter = 0;
  const processed = content.replace(
    /!\[([^\]]*)\]\((data:[^)\s]+)\)/g,
    (_match, alt: string, src: string) => {
      if (!SAFE_DATA_IMAGE_RE.test(src.trim())) {
        return alt ? `[${alt}]` : '';
      }
      const key = `__dataimg_${counter++}`;
      images[key] = src.trim();
      return `![${alt}](${key})`;
    }
  );
  return { processed, images };
}

/**
 * Finds the first safe image URL in markdown content (inline data URI or https URL)
 * so feed cards can display an automatic editorial thumbnail when no cover is set.
 */
export function extractFirstMarkdownImage(content: string): string | undefined {
  const match = content.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (!match?.[1]) return undefined;
  const candidate = match[1].trim();
  return isSafeImageSrc(candidate) ? candidate : undefined;
}

/**
 * Strips markdown syntax and inline images to generate a clean reading excerpt.
 */
export function summarizeMarkdownExcerpt(raw: string, maxLen = 190): string {
  const stripped = raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

  const firstParagraph = stripped
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .find((p) => p.length > 0);

  const text = firstParagraph || stripped.replace(/\s+/g, ' ');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

/**
 * Estimates reading time in minutes (220 wpm) excluding base64 data URIs.
 */
export function estimateReadingMinutes(raw: string): number {
  const clean = raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#*_`~>[\]()-]/g, ' ')
    .trim();
  if (!clean) return 1;
  const words = clean.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Returns a hardened custom img component for ReactMarkdown that resolves
 * extracted data image placeholders and renders editorial inline figures with
 * optional captions (derived from alt text).
 */
export function createImgRenderer(images: Record<string, string>) {
  const ImgRenderer = ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => {
    const rawSrc = typeof src === 'string' ? src : '';
    const resolvedSrc = (rawSrc && images[rawSrc]) || rawSrc;
    if (!resolvedSrc || !isSafeImageSrc(resolvedSrc)) return null;
    const caption = typeof alt === 'string' ? alt.trim() : '';
    const showCaption = Boolean(
      caption && !/^image$/i.test(caption) && !/^img[_-]?\d+$/i.test(caption)
    );
    return (
      <span className="my-6 block space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt={caption}
          loading="lazy"
          decoding="async"
          className="w-full h-auto rounded-[2px] border border-line bg-surface/60 block"
        />
        {showCaption && (
          <span className="block font-mono text-[11px] text-ink-muted text-center leading-relaxed">
            {caption}
          </span>
        )}
      </span>
    );
  };
  ImgRenderer.displayName = 'ImgRenderer';
  return ImgRenderer;
}

/**
 * Returns a hardened custom anchor component for ReactMarkdown that enforces
 * safe URL protocols and opens external links with rel="noopener noreferrer".
 */
export function createLinkRenderer() {
  const LinkRenderer = ({
    href,
    children,
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref || !isSafeLinkHref(rawHref)) {
      return <span>{children}</span>;
    }
    const isExternal = /^https?:\/\//i.test(rawHref);
    return (
      <a
        href={rawHref}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="text-ink underline underline-offset-4 hover:opacity-80 transition-opacity"
      >
        {children}
      </a>
    );
  };
  LinkRenderer.displayName = 'LinkRenderer';
  return LinkRenderer;
}
