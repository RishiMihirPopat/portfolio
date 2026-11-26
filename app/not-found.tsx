import Link from 'next/link';
import { ScrambleHeading } from '@/components/ScrambleHeading';

export default function NotFound() {
  return (
    <article
      data-ascii-panel="true"
      className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
    >
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div className="w-fit">
          <ScrambleHeading
            text="404"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink tabular-nums"
          />
        </div>
      </div>

      <div className="section-content-reveal border-t border-line pt-4 space-y-4">
        <p className="font-sans text-sm text-ink-nav leading-relaxed max-w-prose">
          The page you are looking for does not exist or has been moved.
        </p>
        <div>
          <Link
            href="/"
            className="quiet-link font-mono text-xs min-h-[44px] inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            <span aria-hidden="true">←</span>
            <span>return home</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
