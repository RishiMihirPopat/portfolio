'use client';

import { useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { mockRepos, type Repo } from '@/lib/data';
import { fetchHiddenRepos } from '@/lib/storage';
import { useGithubRepos } from '@/hooks/useGithubRepos';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { CALM_EASE } from '@/components/CollapsibleLog';

export function ProjectsSection() {
  const [hiddenRepos, setHiddenRepos] = useState<string[]>([]);
  const { repos: liveRepos } = useGithubRepos();

  useEffect(() => {
    let active = true;
    fetchHiddenRepos()
      .then((loaded) => {
        if (active) setHiddenRepos(loaded);
      })
      .catch((err) => {
        console.error('Failed to load hidden project settings:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const allProjects = useMemo(() => {
    const hiddenSet = new Set(hiddenRepos.map((n) => n.toLowerCase()));
    const seededNames = new Set(mockRepos.map((r) => r.name.toLowerCase()));
    const extras = liveRepos.filter(
      (r) => !seededNames.has(r.name.toLowerCase())
    );
    return [...mockRepos, ...extras].filter(
      (r) => !hiddenSet.has(r.name.toLowerCase())
    );
  }, [liveRepos, hiddenRepos]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.article
        data-ascii-panel="true"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: CALM_EASE }}
        className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
      >
        <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
          <div className="w-fit">
            <ScrambleHeading
              text="Projects"
              className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
            />
          </div>
        </div>

        <div className="section-content-reveal w-full space-y-4 sm:space-y-5">
          <div className="divide-y divide-line border-t border-line">
            {allProjects.length === 0 ? (
              <p className="font-sans text-sm text-ink-muted py-6">
                No projects listed yet.
              </p>
            ) : (
              allProjects.map((repo: Repo, idx) => {
                const isExternal = Boolean(
                  repo.html_url && /^https?:\/\//i.test(repo.html_url)
                );
                const rawTags = repo.tags || [];
                const lang = (repo.language || 'Python').trim();
                const mergedTags = [
                  lang,
                  ...rawTags.filter((t) => t.toLowerCase() !== lang.toLowerCase()),
                ];

                return (
                  <motion.a
                    key={repo.id}
                    href={repo.html_url || '#'}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.26,
                      delay: Math.min(idx * 0.03, 0.15),
                      ease: CALM_EASE,
                    }}
                    className="block py-3.5 sm:py-4 group space-y-1.5 cursor-pointer transition-[opacity,transform] duration-200 active:opacity-75"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-mono text-sm sm:text-base font-normal text-ink group-hover:underline underline-offset-4">
                        {repo.title || repo.name}
                      </h2>
                      {isExternal && (
                        <span
                          aria-hidden="true"
                          className="font-mono text-xs text-ink-nav group-hover:text-ink motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 transition-[color,transform] duration-200 shrink-0"
                        >
                          ↗
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-xs sm:text-sm text-ink/90 leading-relaxed">
                      {repo.description}
                    </p>
                    {mergedTags.length > 0 && (
                      <p className="font-mono text-[11px] sm:text-xs text-ink-muted leading-relaxed">
                        {mergedTags.join(' · ')}
                      </p>
                    )}
                  </motion.a>
                );
              })
            )}
          </div>
        </div>
      </motion.article>
    </MotionConfig>
  );
}
