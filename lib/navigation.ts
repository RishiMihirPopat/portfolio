import { BeachSectionId } from '@/components/AsciiBeachCanvas';

export interface NavPageItem {
  id: BeachSectionId;
  label: string;
  heading: string;
  href: string;
  /** Group index in the desktop header (1: core work/study, 2: media/writing, 3: CTA) */
  group?: 1 | 2 | 3;
  /** Optional 1–6 keyboard shortcut */
  shortcut?: string;
  /** Whether to style as the primary call-to-action link (Resume ↓) */
  isCta?: boolean;
  /** Whether to show in the top header nav row (Home is linked via the left brand name) */
  showInHeader: boolean;
}

export const ALL_PAGES: NavPageItem[] = [
  {
    id: 'home',
    label: 'Home',
    heading: 'Rishi Mihir Popat',
    href: '/',
    showInHeader: false,
  },
  {
    id: 'projects',
    label: 'Projects',
    heading: 'Projects',
    href: '/projects',
    group: 1,
    shortcut: '1',
    showInHeader: true,
  },
  {
    id: 'experience',
    label: 'Work',
    heading: 'Work',
    href: '/work',
    group: 1,
    shortcut: '2',
    showInHeader: true,
  },
  {
    id: 'academics',
    label: 'Education',
    heading: 'Education',
    href: '/education',
    group: 1,
    shortcut: '3',
    showInHeader: true,
  },
  {
    id: 'skills',
    label: 'Skills',
    heading: 'Skills',
    href: '/skills',
    group: 1,
    shortcut: '4',
    showInHeader: true,
  },
  {
    id: 'photography',
    label: 'Photography',
    heading: 'Photography',
    href: '/photography',
    group: 2,
    shortcut: '5',
    showInHeader: true,
  },
  {
    id: 'blog',
    label: 'Blog',
    heading: 'Blog',
    href: '/blog',
    group: 2,
    shortcut: '6',
    showInHeader: true,
  },
  {
    id: 'resume',
    label: 'Resume',
    heading: 'Resume',
    href: '/resume',
    group: 3,
    isCta: true,
    showInHeader: true,
  },
];

export const HEADER_NAV_ITEMS: NavPageItem[] = ALL_PAGES.filter((p) => p.showInHeader);

export function normalizePathname(pathname: string | null): string {
  if (!pathname) return '/';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  let clean = pathname;
  if (basePath && clean.startsWith(basePath)) {
    clean = clean.slice(basePath.length) || '/';
  }
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  if (clean === '/photos') return '/photography';
  if (clean === '/journal') return '/blog';
  return clean || '/';
}

export function getPageByPathname(pathname: string | null): NavPageItem {
  const norm = normalizePathname(pathname);
  return ALL_PAGES.find((p) => p.href === norm) || ALL_PAGES[0];
}

export function getAdjacentPages(pathname: string | null): {
  prev: NavPageItem;
  next: NavPageItem;
} {
  const norm = normalizePathname(pathname);
  const idx = ALL_PAGES.findIndex((p) => p.href === norm);
  const currentIdx = idx === -1 ? 0 : idx;
  const prevIdx = (currentIdx - 1 + ALL_PAGES.length) % ALL_PAGES.length;
  const nextIdx = (currentIdx + 1) % ALL_PAGES.length;
  return {
    prev: ALL_PAGES[prevIdx],
    next: ALL_PAGES[nextIdx],
  };
}
