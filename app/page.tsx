'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Repo,
  Photo,
  Post,
  Skill,
  profileData,
  mockRepos,
  experiences,
  education,
} from '@/lib/data';
import { fetchAllPosts, fetchAllPhotos, fetchAllSkills } from '@/lib/storage';
import { useGithubRepos } from '@/hooks/useGithubRepos';
import { BeachSectionId } from '@/components/AsciiBeachCanvas';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RepoDetailsModal } from '@/components/RepoDetailsModal';
import { PostDetailsModal } from '@/components/PostDetailsModal';
import { PhotoLightbox } from '@/components/PhotoLightbox';

const NAV_ITEMS: { id: BeachSectionId; label: string; heading: string }[] = [
  { id: 'home', label: 'Home', heading: 'Rishi Mihir Popat' },
  { id: 'projects', label: 'Projects', heading: 'Projects' },
  { id: 'resume', label: 'Resume', heading: 'Resume' },
  { id: 'photography', label: 'Photography', heading: 'Photography' },
  { id: 'blog', label: 'Blog', heading: 'Blog' },
  { id: 'experience', label: 'Professional history', heading: 'Professional history' },
  { id: 'academics', label: 'Academic history', heading: 'Academic history' },
  { id: 'skills', label: 'Skills', heading: 'Skills' },
];

const VALID_SECTIONS = new Set<string>(NAV_ITEMS.map((i) => i.id));

export default function Home() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<BeachSectionId>('home');
  const [adminClicks, setAdminClicks] = useState(0);

  const [posts, setPosts] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { repos: liveRepos } = useGithubRepos();

  const allProjects = useMemo(() => {
    const seededNames = new Set(mockRepos.map((r) => r.name.toLowerCase()));
    const extras = liveRepos.filter(
      (r) => !seededNames.has(r.name.toLowerCase()) && r.featured
    );
    return [...mockRepos, ...extras];
  }, [liveRepos]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedPosts, loadedPhotos] = await Promise.all([
        fetchAllPosts(),
        fetchAllPhotos(),
      ]);
      if (!active) return;
      setPosts(loadedPosts);
      setPhotos(loadedPhotos);

      const storedSkills = fetchAllSkills();
      const map = new Map<string, Skill>();
      for (const s of storedSkills) {
        map.set(s.label.toLowerCase(), s);
      }
      setSkills(Array.from(map.values()));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const raw = window.location.hash.replace(/^#/, '').toLowerCase();
      const nextSec: BeachSectionId = VALID_SECTIONS.has(raw)
        ? (raw as BeachSectionId)
        : 'home';
      setActiveSection(nextSec);
      window.dispatchEvent(
        new CustomEvent<BeachSectionId>('ascii-section-change', { detail: nextSec })
      );
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const navigateTo = (sec: BeachSectionId) => {
    setActiveSection(sec);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `#${sec}`);
      window.dispatchEvent(
        new CustomEvent<BeachSectionId>('ascii-section-change', { detail: sec })
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTitleClick = () => {
    setAdminClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        router.push('/admin');
        return 0;
      }
      return next;
    });
  };

  const currentNav = NAV_ITEMS.find((i) => i.id === activeSection) || NAV_ITEMS[0];

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const s of skills) {
      const list = groups.get(s.category) || [];
      list.push(s.label);
      groups.set(s.category, list);
    }
    return Array.from(groups.entries());
  }, [skills]);

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-10 md:px-14 py-5 sm:py-8 w-full">
      {/* Header on one row: name left, links right, theme toggle as a small icon */}
      <header
        data-ascii-header="true"
        className="flex items-center justify-between gap-4 w-full whitespace-nowrap"
      >
        <button
          onClick={() => navigateTo('home')}
          className="font-mono text-xs text-ink hover:opacity-80 transition-opacity cursor-pointer text-left shrink-0"
        >
          Rishi Popat
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-x-3.5 sm:gap-x-4 font-mono text-xs overflow-x-auto no-scrollbar"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(item.id);
                  }}
                  data-active={isActive}
                  className={`quiet-link cursor-pointer shrink-0 ${
                    isActive
                      ? 'text-ink underline underline-offset-4 decoration-1'
                      : 'text-ink-muted'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area — Left-aligned, max 560px so the beach dominates the right half */}
      <main className="flex-1 flex flex-col justify-start pt-8 sm:pt-14 pb-12 w-full">
        {activeSection === 'home' ? (
          /* Home: no panel at all — just the name, one line, and the scene */
          <div
            data-ascii-panel="true"
            onClick={handleTitleClick}
            className="w-fit max-w-[540px] space-y-1.5 select-none"
          >
            <ScrambleHeading
              text="Rishi Mihir Popat"
              className="font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink"
            />
            <p className="font-sans text-sm sm:text-base text-ink-muted leading-relaxed">
              MSc Data Science at Manipal Academy of Higher Education — statistical modeling, Bayesian computation, and deep learning.
            </p>
          </div>
        ) : (
          /* Active Section Column: max-w-[560px], left-aligned, direct over scene */
          <article
            data-ascii-panel="true"
            className="w-full max-w-[560px] space-y-4 sm:space-y-5"
          >
            <ScrambleHeading
              text={currentNav.heading}
              className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
            />

            {/* PROJECTS */}
            {activeSection === 'projects' && (
              <div className="divide-y divide-line border-t border-line">
                {allProjects.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo)}
                    className="py-3 sm:py-4 group cursor-pointer space-y-1"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-mono text-sm sm:text-base font-medium text-ink group-hover:underline underline-offset-4">
                        {repo.title || repo.name}
                      </h2>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {repo.language || 'Python'} ↗
                      </span>
                    </div>
                    <p className="font-sans text-xs sm:text-sm text-ink/90 leading-relaxed line-clamp-2">
                      {repo.description}
                    </p>
                    {repo.tags && repo.tags.length > 0 && (
                      <p className="font-mono text-[11px] sm:text-xs text-ink-muted truncate">
                        {repo.tags.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* RESUME */}
            {activeSection === 'resume' && (
              <div className="space-y-5 border-t border-line pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-sans text-sm text-ink-muted">
                    Curriculum vitae — academic record, research, and work history.
                  </p>
                  <a
                    href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/resume.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 shrink-0"
                  >
                    Download PDF ↓
                  </a>
                </div>

                <div className="divide-y divide-line border-t border-line text-sm">
                  <div className="py-3.5 space-y-2">
                    <h2 className="font-mono text-xs text-ink-muted">Education</h2>
                    {education.map((edu, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                        <div className="font-sans">
                          <span className="text-ink font-medium">{edu.degree}</span>
                          <span className="text-ink-muted"> · {edu.school}</span>
                        </div>
                        <span className="font-mono text-xs text-ink-muted shrink-0">
                          {edu.duration}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="py-3.5 space-y-2">
                    <h2 className="font-mono text-xs text-ink-muted">Experience</h2>
                    {experiences.map((exp, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                        <div className="font-sans">
                          <span className="text-ink font-medium">{exp.role}</span>
                          <span className="text-ink-muted"> · {exp.company}</span>
                        </div>
                        <span className="font-mono text-xs text-ink-muted shrink-0">
                          {exp.duration}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="py-3.5 space-y-1.5">
                    <h2 className="font-mono text-xs text-ink-muted">Methods & tools</h2>
                    <p className="font-mono text-xs text-ink/90 leading-relaxed">
                      SAS · R · Python · SQL · Regression · Experimental Design · Bayesian Computation · Deep Learning · Text Mining
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PHOTOGRAPHY */}
            {activeSection === 'photography' && (
              <div className="divide-y divide-line border-t border-line">
                {photos.length === 0 ? (
                  <p className="font-sans text-sm text-ink-muted py-6">
                    No photographs archived yet.
                  </p>
                ) : (
                  photos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="py-3.5 group cursor-pointer space-y-1"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="font-mono text-sm font-medium text-ink group-hover:underline underline-offset-4">
                          {photo.title}
                        </h2>
                        <span className="font-mono text-xs text-ink-muted shrink-0">
                          {photo.createdAt
                            ? new Date(photo.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                              })
                            : ''}{' '}
                          ↗
                        </span>
                      </div>
                      {photo.description && (
                        <p className="font-sans text-sm text-ink-muted leading-relaxed">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* BLOG */}
            {activeSection === 'blog' && (
              <div className="divide-y divide-line border-t border-line">
                {posts.length === 0 ? (
                  <p className="font-sans text-sm text-ink-muted py-6">
                    No notes published yet.
                  </p>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="py-4 group cursor-pointer space-y-1"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="font-mono text-sm sm:text-base font-medium text-ink group-hover:underline underline-offset-4">
                          {post.title}
                        </h2>
                        {post.createdAt && (
                          <span className="font-mono text-xs text-ink-muted shrink-0">
                            {new Date(post.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="font-sans text-sm text-ink-muted line-clamp-2 leading-relaxed">
                        {post.content.replace(/[#*`]/g, '')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PROFESSIONAL HISTORY */}
            {activeSection === 'experience' && (
              <div className="divide-y divide-line border-t border-line">
                {experiences.map((exp, i) => (
                  <div key={i} className="py-4 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h2 className="font-mono text-sm sm:text-base font-medium text-ink">
                        {exp.role} <span className="text-ink-muted">· {exp.company}</span>
                      </h2>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {exp.duration}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-ink/90 leading-relaxed">
                      {exp.summary}
                    </p>
                    <ul className="space-y-1 font-sans text-sm text-ink-muted list-disc pl-4">
                      {exp.highlights.map((h, j) => (
                        <li key={j} className="leading-relaxed">
                          {h}
                        </li>
                      ))}
                    </ul>
                    {exp.stack && exp.stack.length > 0 && (
                      <p className="font-mono text-xs text-ink-muted pt-0.5">
                        {exp.stack.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ACADEMIC HISTORY */}
            {activeSection === 'academics' && (
              <div className="divide-y divide-line border-t border-line">
                {education.map((edu, i) => (
                  <div key={i} className="py-4 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h2 className="font-mono text-sm sm:text-base font-medium text-ink">
                        {edu.degree}
                      </h2>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {edu.duration}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-ink/90">
                      {edu.school}, {edu.location}
                    </p>
                    <p className="font-mono text-xs text-ink-muted">
                      {edu.specialization}
                    </p>
                    <ul className="space-y-1 font-sans text-sm text-ink-muted list-disc pl-4">
                      {edu.highlights.map((h, j) => (
                        <li key={j} className="leading-relaxed">
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* SKILLS */}
            {activeSection === 'skills' && (
              <div className="divide-y divide-line border-t border-line">
                {groupedSkills.map(([category, items]) => (
                  <div key={category} className="py-3.5 space-y-1">
                    <h2 className="font-mono text-xs text-ink-muted">{category}</h2>
                    <p className="font-mono text-sm text-ink leading-relaxed">
                      {items.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="flex items-center justify-between gap-4 font-mono text-xs text-ink-muted">
        <div data-ascii-footer="true" className="flex items-center gap-4 w-fit">
          <a
            href={`mailto:${profileData.email}`}
            className="hover:text-ink transition-colors"
          >
            email
          </a>
          <a
            href={profileData.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition-colors"
          >
            github
          </a>
          <Link
            href="/admin"
            className="hover:text-ink transition-colors opacity-50 hover:opacity-100"
          >
            admin
          </Link>
        </div>
      </footer>

      {/* Detail Modals & Lightbox */}
      <RepoDetailsModal repo={selectedRepo} onClose={() => setSelectedRepo(null)} />
      <PostDetailsModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      <PhotoLightbox
        photo={selectedPhoto}
        photos={photos}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
      />
    </div>
  );
}
