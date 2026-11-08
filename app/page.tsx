'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, ArrowUpRight, Mail, Github } from 'lucide-react';
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
  { id: 'blog', label: 'Blog', heading: 'Blog & Notes' },
  { id: 'experience', label: 'Professional history', heading: 'Professional History' },
  { id: 'academics', label: 'Academic history', heading: 'Academic History' },
  { id: 'skills', label: 'Skills', heading: 'Skills & Methods' },
];

const VALID_SECTIONS = new Set<string>(NAV_ITEMS.map((i) => i.id));

export default function Home() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<BeachSectionId>('home');
  const [adminClicks, setAdminClicks] = useState(0);

  // Data states (Firebase / LocalStorage fallback + seeded defaults)
  const [posts, setPosts] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillCategory, setSkillCategory] = useState<string>('All');

  // Modals & Lightbox
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { repos: liveRepos } = useGithubRepos();

  // Merge seeded featured projects with any additional live GitHub repos
  const allProjects = useMemo(() => {
    const seededNames = new Set(mockRepos.map((r) => r.name.toLowerCase()));
    const extras = liveRepos.filter((r) => !seededNames.has(r.name.toLowerCase()));
    return [...mockRepos, ...extras];
  }, [liveRepos]);

  // Load posts, photos, and skills from storage layer
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

      // Merge stored skills with seeded cvSkills so new required skills are always present
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

  // Synchronize active section with URL hash and notify AsciiBeachCanvas
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

  const skillCategories = useMemo(() => {
    const cats = Array.from(new Set(skills.map((s) => s.category)));
    return ['All', ...cats];
  }, [skills]);

  const filteredSkills = useMemo(() => {
    if (skillCategory === 'All') return skills;
    return skills.filter((s) => s.category === skillCategory);
  }, [skills, skillCategory]);

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-8 md:px-12 py-6 sm:py-10 max-w-4xl mx-auto w-full">
      {/* Quiet Top Navigation */}
      <header className="flex flex-col gap-4 pb-6 border-b border-line">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigateTo('home')}
            className="font-mono text-xs tracking-wider uppercase text-ink hover:opacity-80 transition-opacity cursor-pointer text-left"
          >
            rishi mihir popat <span className="text-ink-muted">· msc data science</span>
          </button>
          <ThemeToggle />
        </div>

        <nav
          aria-label="Primary sections"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs"
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
                className={`quiet-link py-0.5 cursor-pointer ${
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
      </header>

      {/* Active Content Panel — Measured by AsciiBeachCanvas for wave & foam wrapping */}
      <main className="my-auto py-10 sm:py-14">
        <article
          data-ascii-panel="true"
          className="quiet-panel p-6 sm:p-10 space-y-8"
        >
          {/* Section Header with Character Scramble */}
          <div className="space-y-1.5 border-b border-line pb-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-muted flex items-center justify-between">
              <span>{currentNav.label}</span>
              <span>
                {activeSection === 'home' && 'manipal academy of higher education'}
                {activeSection === 'projects' && `${allProjects.length} selected works`}
                {activeSection === 'resume' && 'curriculum vitae'}
                {activeSection === 'photography' && `${photos.length} frames`}
                {activeSection === 'blog' && `${posts.length} notes`}
                {activeSection === 'experience' && `${experiences.length} roles`}
                {activeSection === 'academics' && `${education.length} degrees`}
                {activeSection === 'skills' && `${skills.length} competencies`}
              </span>
            </div>
            <div
              onClick={activeSection === 'home' ? handleTitleClick : undefined}
              className={activeSection === 'home' ? 'cursor-default select-none' : ''}
            >
              <ScrambleHeading
                text={currentNav.heading}
                className="text-2xl sm:text-3xl font-medium tracking-tight text-ink font-mono"
              />
            </div>
          </div>

          {/* SECTION 1: HOME */}
          {activeSection === 'home' && (
            <div className="space-y-6">
              <p className="text-base sm:text-lg text-ink leading-relaxed font-normal">
                {profileData.intro}
              </p>
              <p className="text-sm text-ink-muted leading-relaxed">
                {profileData.secondaryNote}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-mono text-xs">
                <div className="p-4 rounded border border-line space-y-1.5">
                  <div className="text-ink-muted uppercase text-[10px] tracking-wider">
                    Current Program
                  </div>
                  <div className="text-ink font-medium">M.Sc. in Data Science</div>
                  <div className="text-ink-muted">
                    Manipal Academy of Higher Education
                  </div>
                </div>
                <div className="p-4 rounded border border-line space-y-1.5">
                  <div className="text-ink-muted uppercase text-[10px] tracking-wider">
                    Core Focus
                  </div>
                  <div className="text-ink font-medium">
                    Bayesian Modeling & Deep Active Learning
                  </div>
                  <div className="text-ink-muted">
                    SAS · R · Python · Experimental Design
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigateTo('projects')}
                  className="quiet-btn"
                >
                  <span>View Projects</span>
                  <ArrowUpRight size={13} />
                </button>
                <button
                  onClick={() => navigateTo('resume')}
                  className="quiet-btn"
                >
                  <span>Resume & PDF</span>
                </button>
                <a
                  href={`mailto:${profileData.email}`}
                  className="quiet-btn text-ink-muted"
                >
                  <Mail size={13} />
                  <span>{profileData.email}</span>
                </a>
                <a
                  href={profileData.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quiet-btn text-ink-muted"
                >
                  <Github size={13} />
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          )}

          {/* SECTION 2: PROJECTS */}
          {activeSection === 'projects' && (
            <div className="space-y-6">
              <div className="divide-y divide-line">
                {allProjects.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo)}
                    className="py-5 first:pt-0 last:pb-0 group cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-base font-medium text-ink group-hover:underline underline-offset-4">
                        {repo.title || repo.name}
                      </h2>
                      <span className="font-mono text-xs text-ink-muted shrink-0 flex items-center gap-1">
                        <span>{repo.language || 'Python'}</span>
                        <ArrowUpRight
                          size={12}
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                        />
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      {repo.description}
                    </p>
                    {repo.tags && repo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {repo.tags.map((tag) => (
                          <span key={tag} className="quiet-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: RESUME */}
          {activeSection === 'resume' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded border border-line">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-ink">
                    Full Curriculum Vitae (PDF)
                  </div>
                  <div className="font-mono text-xs text-ink-muted">
                    Includes academic record, coursework, research projects, and work history.
                  </div>
                </div>
                <a
                  href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/resume.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="quiet-btn"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </a>
              </div>

              <div className="space-y-6 text-sm">
                <div className="space-y-3">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Education
                  </h3>
                  {education.map((edu, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <div>
                        <span className="font-medium text-ink">{edu.degree}</span>
                        <span className="text-ink-muted"> · {edu.school}</span>
                      </div>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {edu.duration}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-line">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Selected Experience
                  </h3>
                  {experiences.map((exp, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <div>
                        <span className="font-medium text-ink">{exp.role}</span>
                        <span className="text-ink-muted"> · {exp.company}</span>
                      </div>
                      <span className="font-mono text-xs text-ink-muted shrink-0">
                        {exp.duration}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-line">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Core Statistical & Computational Methods
                  </h3>
                  <p className="text-ink-muted leading-relaxed">
                    SAS, R, Python, SQL, Regression Modeling, Experimental Design, Bayesian Computation, Deep Learning (PyTorch), Active Learning, Text Mining, Computer Vision.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: PHOTOGRAPHY */}
          {activeSection === 'photography' && (
            <div className="space-y-6">
              {photos.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted py-8 text-center">
                  No photographs archived yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="group cursor-pointer space-y-2"
                    >
                      <div className="overflow-hidden rounded border border-line bg-black/20 aspect-[3/2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.title}
                          loading="lazy"
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                        />
                      </div>
                      <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                        <span className="text-ink font-sans font-medium truncate">
                          {photo.title}
                        </span>
                        <span className="text-ink-muted text-[11px] shrink-0">
                          {photo.createdAt
                            ? new Date(photo.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                              })
                            : ''}
                        </span>
                      </div>
                      {photo.description && (
                        <p className="text-xs text-ink-muted line-clamp-1">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: BLOG */}
          {activeSection === 'blog' && (
            <div className="space-y-6">
              {posts.length === 0 ? (
                <p className="font-mono text-xs text-ink-muted py-8 text-center">
                  No notes published yet.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="py-5 first:pt-0 last:pb-0 group cursor-pointer space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <h2 className="text-base font-medium text-ink group-hover:underline underline-offset-4">
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
                      <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                        {post.content.replace(/[#*`]/g, '')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 6: PROFESSIONAL HISTORY */}
          {activeSection === 'experience' && (
            <div className="divide-y divide-line">
              {experiences.map((exp, i) => (
                <div key={i} className="py-6 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <h2 className="text-base font-medium text-ink">
                        {exp.role} <span className="text-ink-muted">· {exp.company}</span>
                      </h2>
                      <div className="font-mono text-xs text-ink-muted">
                        {exp.location}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-ink-muted shrink-0">
                      {exp.duration}
                    </span>
                  </div>

                  <p className="text-sm text-ink/90 leading-relaxed">{exp.summary}</p>

                  <ul className="space-y-1.5 text-sm text-ink-muted list-disc pl-4">
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="leading-relaxed">
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {exp.stack.map((tech) => (
                      <span key={tech} className="quiet-tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SECTION 7: ACADEMIC HISTORY */}
          {activeSection === 'academics' && (
            <div className="divide-y divide-line">
              {education.map((edu, i) => (
                <div key={i} className="py-6 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <h2 className="text-base font-medium text-ink">{edu.degree}</h2>
                      <div className="text-sm text-ink-muted">
                        {edu.school} · {edu.location}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-ink-muted shrink-0">
                      {edu.duration} ({edu.status})
                    </div>
                  </div>

                  <div className="font-mono text-xs text-ink/80">
                    Focus: {edu.specialization}
                  </div>

                  <ul className="space-y-1.5 text-sm text-ink-muted list-disc pl-4">
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

          {/* SECTION 8: SKILLS */}
          {activeSection === 'skills' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                {skillCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSkillCategory(cat)}
                    className={`px-3 py-1 rounded border transition-colors cursor-pointer ${
                      skillCategory === cat
                        ? 'border-ink text-ink bg-ink/5'
                        : 'border-line text-ink-muted hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {filteredSkills.map((skill) => (
                  <span
                    key={skill.label}
                    className="px-3 py-1.5 rounded border border-line font-mono text-xs text-ink"
                  >
                    {skill.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>

      {/* Quiet Footer */}
      <footer className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-ink-muted">
        <div>
          © {new Date().getFullYear()} {profileData.name}
        </div>
        <div className="flex items-center gap-5">
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
          <Link href="/admin" className="hover:text-ink transition-colors opacity-60 hover:opacity-100">
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
