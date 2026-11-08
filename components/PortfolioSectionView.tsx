'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Repo,
  Photo,
  Post,
  Skill,
  mockRepos,
  experiences,
  education,
} from '@/lib/data';
import { fetchAllPosts, fetchAllPhotos, fetchAllSkills } from '@/lib/storage';
import { useGithubRepos } from '@/hooks/useGithubRepos';
import { BeachSectionId } from '@/components/AsciiBeachCanvas';
import { ALL_PAGES } from '@/lib/navigation';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { PostDetailsModal } from '@/components/PostDetailsModal';
import { PhotoLightbox } from '@/components/PhotoLightbox';

function summarizePostContent(raw: string): string {
  const firstParagraph = raw
    .replace(/[#*`]/g, '')
    .split(/\n\s*\n/)[0]
    ?.trim();
  return firstParagraph || raw.replace(/[#*`]/g, '').slice(0, 180);
}

export function PortfolioSectionView({ section }: { section: BeachSectionId }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { repos: liveRepos } = useGithubRepos();

  const resolvedSection: BeachSectionId =
    section === 'experience' || section === 'academics' || section === 'skills'
      ? 'resume'
      : section;

  // Support legacy hash URLs (/#projects, /#work, etc.) by redirecting to real routes
  useEffect(() => {
    if (typeof window === 'undefined' || resolvedSection !== 'home') return;
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    if (!hash) return;
    const hashMap: Record<string, string> = {
      projects: '/projects',
      work: '/resume',
      experience: '/resume',
      education: '/resume',
      academics: '/resume',
      skills: '/resume',
      photography: '/photography',
      photos: '/photography',
      blog: '/blog',
      journal: '/blog',
      resume: '/resume',
    };
    if (hashMap[hash]) {
      router.replace(hashMap[hash]);
    }
  }, [resolvedSection, router]);

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

  const currentNav = ALL_PAGES.find((i) => i.id === resolvedSection) || ALL_PAGES[0];

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const s of skills) {
      const list = groups.get(s.category) || [];
      list.push(s.label);
      groups.set(s.category, list);
    }
    return Array.from(groups.entries());
  }, [skills]);

  if (resolvedSection === 'home') {
    return (
      <div
        data-ascii-panel="true"
        className="w-fit max-w-[540px] space-y-2 pt-2 sm:pt-4"
      >
        <ScrambleHeading
          text="Rishi Mihir Popat"
          className="font-mono text-2xl sm:text-3xl font-medium tracking-tight text-ink"
        />
        <p className="font-sans text-sm sm:text-base text-ink-nav leading-relaxed">
          MSc Data Science at Manipal Academy of Higher Education — statistical modeling, Bayesian computation, and deep learning.
        </p>
      </div>
    );
  }

  return (
    <article className="w-full max-w-[560px]">
      {/* On mobile (<760px): keep a ~22vh scene strip at the top with the heading overlaid */}
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div data-ascii-heading="true" className="w-fit">
          <ScrambleHeading
            text={currentNav.heading}
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      {/* Scrolling content column over thinned scene */}
      <div data-ascii-panel="true" className="w-full space-y-4 sm:space-y-5">
        {/* PROJECTS */}
        {resolvedSection === 'projects' && (
          <div className="divide-y divide-line border-t border-line">
            {allProjects.map((repo: Repo) => {
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
                <a
                  key={repo.id}
                  href={repo.html_url || '#'}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className="block py-3.5 sm:py-4 group space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-mono text-sm sm:text-base font-normal text-ink group-hover:underline underline-offset-4">
                      {repo.title || repo.name}
                    </h2>
                    {isExternal && (
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs text-ink-nav group-hover:text-ink transition-colors shrink-0"
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
                </a>
              );
            })}
          </div>
        )}

        {/* PHOTOGRAPHY */}
        {resolvedSection === 'photography' && (
          <div className="divide-y divide-line border-t border-line">
            {photos.length === 0 ? (
              <p className="font-sans text-sm text-ink-muted py-6">
                No photographs archived yet.
              </p>
            ) : (
              photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className="w-full text-left py-3.5 group cursor-pointer space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-mono text-sm font-normal text-ink group-hover:underline underline-offset-4">
                      {photo.title}
                    </h2>
                    <span className="font-mono text-xs text-ink-muted shrink-0">
                      {photo.createdAt
                        ? new Date(photo.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </span>
                  </div>
                  {photo.description && (
                    <p className="font-sans text-sm text-ink-muted leading-relaxed">
                      {photo.description}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* BLOG */}
        {resolvedSection === 'blog' && (
          <div className="divide-y divide-line border-t border-line">
            {posts.length === 0 ? (
              <p className="font-sans text-sm text-ink-muted py-6">
                No notes published yet.
              </p>
            ) : (
              posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="w-full text-left py-4 group cursor-pointer space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-mono text-sm sm:text-base font-normal text-ink group-hover:underline underline-offset-4">
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
                  <p className="font-sans text-sm text-ink-muted leading-relaxed">
                    {summarizePostContent(post.content)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {/* RESUME (Combined Work, Education, and Skills) */}
        {resolvedSection === 'resume' && (
          <div className="space-y-6 border-t border-line pt-3">
            {/* Top summary & PDF download */}
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="font-sans text-sm text-ink-muted">
                Work, education, and methods.
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/resume.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 min-h-[44px] inline-flex items-center shrink-0"
              >
                Download PDF ↓
              </a>
            </div>

            {/* WORK */}
            <section aria-labelledby="resume-work-heading" className="space-y-2 border-t border-line pt-4">
              <h2 id="resume-work-heading" className="font-mono text-xs text-ink-muted">
                Work
              </h2>
              <div className="divide-y divide-line">
                {experiences.map((exp, i) => (
                  <div key={i} className="py-3.5 first:pt-1.5 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h3 className="font-mono text-sm sm:text-base font-normal text-ink">
                        {exp.role} <span className="text-ink-muted">· {exp.company}</span>
                      </h3>
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
                      <p className="font-mono text-xs text-ink-muted leading-relaxed pt-0.5">
                        {exp.stack.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* EDUCATION */}
            <section aria-labelledby="resume-education-heading" className="space-y-2 border-t border-line pt-4">
              <h2 id="resume-education-heading" className="font-mono text-xs text-ink-muted">
                Education
              </h2>
              <div className="divide-y divide-line">
                {education.map((edu, i) => (
                  <div key={i} className="py-3.5 first:pt-1.5 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h3 className="font-mono text-sm sm:text-base font-normal text-ink">
                        {edu.degree}
                      </h3>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {edu.duration}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-ink/90">
                      {edu.school}, {edu.location}
                    </p>
                    <p className="font-mono text-xs text-ink-muted leading-relaxed">
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
            </section>

            {/* SKILLS */}
            <section aria-labelledby="resume-skills-heading" className="space-y-2 border-t border-line pt-4">
              <h2 id="resume-skills-heading" className="font-mono text-xs text-ink-muted">
                Skills
              </h2>
              <div className="divide-y divide-line">
                {groupedSkills.map(([category, items]) => (
                  <div key={category} className="py-3 first:pt-1.5 space-y-1">
                    <h3 className="font-mono text-xs text-ink-muted">{category}</h3>
                    <p className="font-mono text-sm text-ink leading-relaxed">
                      {items.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Detail Modals & Lightbox */}
      <PostDetailsModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      <PhotoLightbox
        photo={selectedPhoto}
        photos={photos}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
      />
    </article>
  );
}
