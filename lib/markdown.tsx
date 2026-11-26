import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';

const SAFE_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i;

function isSafeImageSrc(src: string): boolean {
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

function isSafeLinkHref(href: string): boolean {
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
 * Returns a hardened custom img component for ReactMarkdown that resolves
 * extracted data image placeholders and enforces a strict image URL allowlist.
 */
export function createImgRenderer(images: Record<string, string>) {
  const ImgRenderer = ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => {
    const rawSrc = typeof src === 'string' ? src : '';
    const resolvedSrc = (rawSrc && images[rawSrc]) || rawSrc;
    if (!resolvedSrc || !isSafeImageSrc(resolvedSrc)) return null;
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={resolvedSrc}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        className="rounded-[2px] border border-line max-w-full"
      />
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
        className="text-ink underline underline-offset-4 hover:opacity-80"
      >
        {children}
      </a>
    );
  };
  LinkRenderer.displayName = 'LinkRenderer';
  return LinkRenderer;
}
