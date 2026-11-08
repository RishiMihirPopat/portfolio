'use client';

import { ExternalLink, Github } from 'lucide-react';
import { Repo } from '@/lib/data';
import { Modal } from '@/components/ui/Modal';

interface RepoDetailsModalProps {
  repo: Repo | null;
  onClose: () => void;
}

export function RepoDetailsModal({ repo, onClose }: RepoDetailsModalProps) {
  return (
    <Modal
      isOpen={!!repo}
      onClose={onClose}
      title={repo ? repo.name : 'Project'}
    >
      {repo && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              {repo.title || repo.name}
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              {repo.description}
            </p>
          </div>

          {repo.details && (
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                Overview & Methodology
              </div>
              <p className="text-sm text-ink/90 leading-relaxed">
                {repo.details}
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-line">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Tools & Methods
            </div>
            <div className="flex flex-wrap gap-2">
              {(repo.tags && repo.tags.length > 0
                ? repo.tags
                : [repo.language || 'Python']
              ).map((tag) => (
                <span key={tag} className="quiet-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between font-mono text-xs text-ink-muted">
            <span>
              Updated {new Date(repo.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
            </span>
            {repo.html_url && (
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="quiet-btn text-xs"
              >
                <Github size={13} />
                <span>Repository</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
