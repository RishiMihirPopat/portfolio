import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AsciiBeachCanvas } from '@/components/AsciiBeachCanvas';
import { SiteShell } from '@/components/SiteShell';
import { JsonLd } from '@/components/JsonLd';
import './globals.css';

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0e12' },
    { media: '(prefers-color-scheme: light)', color: '#e6ebe8' },
  ],
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const metadataBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://rishipopat.site';

export const metadata: Metadata = {
  title: {
    default: 'Rishi Popat',
    template: '%s · Rishi Popat',
  },
  description:
    'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education. Statistical modeling, Bayesian computation, deep learning, and field photography.',
  keywords: [
    'Rishi Popat',
    'Rishi Mihir Popat',
    'Data Science',
    'Manipal Academy of Higher Education',
    'Bayesian Computation',
    'Deep Learning',
    'SAS',
    'R',
    'Python',
  ],
  authors: [{ name: 'Rishi Mihir Popat', url: metadataBase }],
  creator: 'Rishi Mihir Popat',
  metadataBase: new URL(metadataBase),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rishi Popat',
    description:
      'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education.',
    url: '/',
    siteName: 'Rishi Popat',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${basePath}/og.png`,
        width: 1200,
        height: 630,
        alt: 'Rishi Mihir Popat — MSc Data Science & Field Photography',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rishi Popat',
    description:
      'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education.',
    images: [`${basePath}/og.png`],
  },
  icons: {
    icon: [{ url: `${basePath}/icon-32.png`, sizes: '32x32', type: 'image/png' }],
    shortcut: `${basePath}/icon-32.png`,
    apple: [{ url: `${basePath}/apple-icon.png`, sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100lvh] flex flex-col relative overflow-x-hidden antialiased">
        <JsonLd />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={['dark', 'light']}
        >
          {/* Full-viewport procedural ASCII scene background persisted across routes */}
          <AsciiBeachCanvas />

          {/* Foreground persistent navigation shell & content */}
          <div className="relative z-10 flex-1 flex flex-col">
            <SiteShell>{children}</SiteShell>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
