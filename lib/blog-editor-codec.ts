import { isSafeImageSrc, isSafeLinkHref } from '@/lib/markdown';

export type BlogBlockType =
  | 'paragraph'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'ul'
  | 'ol'
  | 'code'
  | 'divider'
  | 'image';

export interface BlogBlock {
  id: string;
  type: BlogBlockType;
  /** Rich HTML for text blocks (paragraph/h2/h3/quote/ul/ol), plain text for code */
  html: string;
  /** Image data URL or https URL when type === 'image' */
  src?: string;
  /** Optional caption / alt text when type === 'image' */
  caption?: string;
}

export function createBlockId(): string {
  return `blk_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyParagraph(): BlogBlock {
  return { id: createBlockId(), type: 'paragraph', html: '' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdownToHtml(md: string): string {
  // Preserve code spans first
  const codeSpans: string[] = [];
  let work = md.replace(/`([^`]+)`/g, (_m, code: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  work = escapeHtml(work);

  // Links [label](href)
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    if (!isSafeLinkHref(href)) return label;
    return `<a href="${escapeHtml(href)}">${label}</a>`;
  });

  // Bold, italic, strikethrough
  work = work.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  work = work.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  work = work.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Restore code spans
  work = work.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => codeSpans[Number(i)] || '');

  return work;
}

/**
 * Parses standard Markdown (including inline data-URI or https photos) into
 * structured Substack-style visual editor blocks.
 */
export function markdownToBlocks(markdown: string): BlogBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [createEmptyParagraph()];

  const lines = normalized.split('\n');
  const blocks: BlogBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({
        id: createBlockId(),
        type: 'code',
        html: codeLines.join('\n'),
      });
      continue;
    }

    // Horizontal divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ id: createBlockId(), type: 'divider', html: '' });
      i++;
      continue;
    }

    // Standalone image line ![caption](src)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imgMatch && isSafeImageSrc(imgMatch[2])) {
      blocks.push({
        id: createBlockId(),
        type: 'image',
        html: '',
        src: imgMatch[2].trim(),
        caption: imgMatch[1].trim(),
      });
      i++;
      continue;
    }

    // Headings (## and ###; also map # to h2 for clean hierarchy under article h1)
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      blocks.push({
        id: createBlockId(),
        type: 'h3',
        html: inlineMarkdownToHtml(h3Match[1].trim()),
      });
      i++;
      continue;
    }
    const h2Match = trimmed.match(/^#{1,2}\s+(.+)$/);
    if (h2Match) {
      blocks.push({
        id: createBlockId(),
        type: 'h2',
        html: inlineMarkdownToHtml(h2Match[1].trim()),
      });
      i++;
      continue;
    }

    // Blockquote (consecutive > lines)
    if (trimmed.startsWith('>')) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        id: createBlockId(),
        type: 'quote',
        html: inlineMarkdownToHtml(qLines.join(' ')),
      });
      continue;
    }

    // Bullet list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({
        id: createBlockId(),
        type: 'ul',
        html: items.map((item) => inlineMarkdownToHtml(item)).join('<br>'),
      });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        id: createBlockId(),
        type: 'ol',
        html: items.map((item) => inlineMarkdownToHtml(item)).join('<br>'),
      });
      continue;
    }

    // Paragraph (may contain inline images mixed in; split images into their own image blocks)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^!\[([^\]]*)\]\(([^)\s]+)\)$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    const joined = paraLines.join(' ');
    const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(joined)) !== null) {
      const before = joined.slice(lastIdx, match.index).trim();
      if (before) {
        blocks.push({
          id: createBlockId(),
          type: 'paragraph',
          html: inlineMarkdownToHtml(before),
        });
      }
      if (isSafeImageSrc(match[2])) {
        blocks.push({
          id: createBlockId(),
          type: 'image',
          html: '',
          src: match[2].trim(),
          caption: match[1].trim(),
        });
      }
      lastIdx = match.index + match[0].length;
    }
    const remainder = joined.slice(lastIdx).trim();
    if (remainder) {
      blocks.push({
        id: createBlockId(),
        type: 'paragraph',
        html: inlineMarkdownToHtml(remainder),
      });
    }
  }

  return blocks.length > 0 ? blocks : [createEmptyParagraph()];
}

function nodeToInlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\u00a0/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') return '\n';

  const inner = Array.from(el.childNodes).map(nodeToInlineMarkdown).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return inner.trim() ? `**${inner}**` : inner;
    case 'em':
    case 'i':
      return inner.trim() ? `*${inner}*` : inner;
    case 's':
    case 'del':
    case 'strike':
      return inner.trim() ? `~~${inner}~~` : inner;
    case 'code':
      return inner ? `\`${inner.replace(/`/g, "'")}\`` : '';
    case 'a': {
      const href = el.getAttribute('href')?.trim() || '';
      if (!href || !isSafeLinkHref(href)) return inner;
      return `[${inner || href}](${href})`;
    }
    case 'div':
    case 'p':
      return `${inner}\n`;
    default:
      return inner;
  }
}

export function htmlFragmentToInlineMarkdown(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, '').trim();
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  return Array.from(root.childNodes)
    .map(nodeToInlineMarkdown)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Serializes structured visual editor blocks cleanly to portable Markdown.
 */
export function blocksToMarkdown(blocks: BlogBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'divider') {
      parts.push('---');
      continue;
    }

    if (block.type === 'image') {
      if (block.src && isSafeImageSrc(block.src)) {
        const safeCaption = (block.caption || '').replace(/[\[\]]/g, '').trim();
        parts.push(`![${safeCaption}](${block.src})`);
      }
      continue;
    }

    if (block.type === 'code') {
      const rawCode = block.html.replace(/\r\n/g, '\n').trimEnd();
      if (rawCode) {
        parts.push(`\`\`\`\n${rawCode}\n\`\`\``);
      }
      continue;
    }

    const md = htmlFragmentToInlineMarkdown(block.html);
    if (!md) continue;

    if (block.type === 'h2') {
      parts.push(`## ${md.replace(/\n+/g, ' ')}`);
    } else if (block.type === 'h3') {
      parts.push(`### ${md.replace(/\n+/g, ' ')}`);
    } else if (block.type === 'quote') {
      parts.push(
        md
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')
      );
    } else if (block.type === 'ul') {
      const items = md
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (items.length > 0) {
        parts.push(items.map((item) => `- ${item}`).join('\n'));
      }
    } else if (block.type === 'ol') {
      const items = md
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (items.length > 0) {
        parts.push(items.map((item, idx) => `${idx + 1}. ${item}`).join('\n'));
      }
    } else {
      parts.push(md);
    }
  }

  return parts.join('\n\n');
}
