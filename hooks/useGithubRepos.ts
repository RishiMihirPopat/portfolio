import { useState, useEffect } from 'react';
import { Repo, mockRepos } from '@/lib/data';

export function useGithubRepos() {
  const [repos, setRepos] = useState<Repo[]>(mockRepos);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchLiveGithubRepos = async () => {
      try {
        const res = await fetch('/api/github-repos');
        if (res.ok) {
          const data = await res.json();
          const liveRepos = Array.isArray(data?.repos) ? data.repos : [];
          if (active && liveRepos.length > 0) {
            setRepos(liveRepos);
          }
        }
      } catch {
        console.warn('Live repos fetch failed, using local mockRepos');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLiveGithubRepos();
    return () => {
      active = false;
    };
  }, []);

  return { repos, loading };
}
