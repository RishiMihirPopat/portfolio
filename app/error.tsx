'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ScrambleHeading } from '@/components/ScrambleHeading';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <article
      data-ascii-panel="true"
      className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
    >
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div className="w-fit">
          <ScrambleHeading
            text="Something went wrong"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      <div className="section-content-reveal border-t border-line pt-4 space-y-4">
        <p className="font-sans text-sm text-ink-nav leading-relaxed max-w-prose">
          An unexpected error interrupted this view. You can retry rendering or return to the home page.
        </p>
        <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
          <button
            type="button"
            onClick={() => reset()}
            className="border border-line-control bg-surface/85 px-3.5 min-h-[40px] rounded-[2px] text-ink hover:border-ink transition-colors cursor-pointer"
          >
            try again
          </button>
          <Link
            href="/"
            className="quiet-link min-h-[44px] inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            <span aria-hidden="true">←</span>
            <span>return home</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
