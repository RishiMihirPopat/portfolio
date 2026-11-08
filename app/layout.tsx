import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AsciiBeachCanvas } from '@/components/AsciiBeachCanvas';
import { SiteShell } from '@/components/SiteShell';
import './globals.css';

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

const metadataBase = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: {
    default: 'Rishi Popat',
    template: '%s · Rishi Popat',
  },
  description:
    'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education.',
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
  authors: [{ name: 'Rishi Mihir Popat' }],
  openGraph: {
    title: 'Rishi Popat',
    description:
      'Rishi Mihir Popat — MSc Data Science student at Manipal Academy of Higher Education.',
    type: 'website',
    locale: 'en_US',
  },
  metadataBase: new URL(metadataBase),
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/profile.png`,
    shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/profile.png`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/profile.png`,
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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          themes={['dark', 'light']}
        >
          {/* Full-viewport procedural ASCII beach background persisted across routes */}
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
