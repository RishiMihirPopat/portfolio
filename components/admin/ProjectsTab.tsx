'use client';

import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { Repo } from '@/lib/data';
import { TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SECONDARY_BTN_CLASS,
} from '@/components/admin/shared';

export type AdminProjectItem = Repo & { source: 'featured' | 'github' };

interface ProjectsTabProps {
  allAdminProjects: AdminProjectItem[];
  hiddenRepos: string[];
  extraHiddenRepoNames: string[];
  customHiddenRepoName: string;
  onCustomHiddenRepoNameChange: (value: string) => void;
  onAddCustomHiddenRepo: (e: React.FormEvent) => void;
  onToggleRepoVisibility: (repoName: string, displayLabel?: string) => void;
}

export function ProjectsTab({
  allAdminProjects,
  hiddenRepos,
  extraHiddenRepoNames,
  customHiddenRepoName,
  onCustomHiddenRepoNameChange,
  onAddCustomHiddenRepo,
  onToggleRepoVisibility,
}: ProjectsTabProps) {
  return (
    <div className="space-y-6">
      <p className="font-sans text-xs sm:text-sm text-ink-muted">
        Hide or show GitHub and featured projects listed on{' '}
        <span className="font-mono text-ink">/projects</span>.
      </p>

      {/* Pre-hide any GitHub repository by exact slug or URL */}
      <form
        onSubmit={onAddCustomHiddenRepo}
        aria-label="Hide GitHub repository by name"
        className="flex flex-wrap items-end gap-3 border border-line bg-surface/60 p-3.5 rounded-[2px]"
      >
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="hide-repo-name" className={LABEL_CLASS}>
            Hide GitHub repo by name (or URL)
          </label>
          <input
            id="hide-repo-name"
            type="text"
            value={customHiddenRepoName}
            onChange={(e) => onCustomHiddenRepoNameChange(e.target.value)}
            className={`${INPUT_CLASS} font-mono text-xs`}
            placeholder="e.g. portfolio or dotfiles"
          />
        </div>
        <div className="shrink-0">
          <motion.button
            type="submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={TACTILE_SPRING}
            className={SECONDARY_BTN_CLASS}
          >
            <EyeOff size={13} aria-hidden="true" />
            <span>Hide repo</span>
          </motion.button>
        </div>
      </form>

      {/* Loaded projects list */}
      <div className="divide-y divide-line border-t border-line">
        {allAdminProjects.map((repo) => {
          const isHidden = hiddenRepos.includes(repo.name.toLowerCase());
          return (
            <motion.div
              key={`${repo.source}-${repo.id}-${repo.name}`}
              layout
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div
                className={`min-w-0 flex-1 space-y-1 transition-opacity ${
                  isHidden ? 'opacity-65' : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-mono text-sm font-normal text-ink truncate">
                    {repo.title || repo.name}
                  </h2>
                  <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px] shrink-0">
                    {repo.source}
                  </span>
                  {isHidden && (
                    <span className="font-mono text-[10px] text-ink border border-line-control px-1.5 py-0.5 rounded-[2px] shrink-0">
                      hidden
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-ink-muted truncate">
                  {repo.name}
                  {repo.language ? ` · ${repo.language}` : ''}
                </p>
                {repo.description && (
                  <p className="font-sans text-xs text-ink-muted line-clamp-2">
                    {repo.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() =>
                    onToggleRepoVisibility(repo.name, repo.title || repo.name)
                  }
                  className="font-mono text-xs border border-line-control bg-surface/85 px-3 py-1.5 rounded-[2px] text-ink hover:border-ink transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                >
                  {isHidden ? (
                    <Eye size={13} aria-hidden="true" />
                  ) : (
                    <EyeOff size={13} aria-hidden="true" />
                  )}
                  <span>{isHidden ? 'Show' : 'Hide'}</span>
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Extra hidden repo names not currently in the synced list */}
      {extraHiddenRepoNames.length > 0 && (
        <div className="border-t border-line pt-4 space-y-2.5">
          <h2 className="font-mono text-xs text-ink-muted tabular-nums">
            Other hidden repo names ({extraHiddenRepoNames.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {extraHiddenRepoNames.map((repoName) => (
              <span
                key={repoName}
                className="inline-flex items-center gap-2 border border-line-control bg-surface/85 pl-2.5 pr-1 font-mono text-xs text-ink rounded-[2px]"
              >
                <span>{repoName}</span>
                <button
                  type="button"
                  onClick={() => onToggleRepoVisibility(repoName)}
                  aria-label={`Unhide ${repoName}`}
                  className="text-ink-muted hover:text-ink underline underline-offset-2 cursor-pointer text-[11px] min-h-[32px] px-1.5 inline-flex items-center"
                >
                  show
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
