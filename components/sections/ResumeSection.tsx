'use client';

import { useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { cvSkills, education, experiences, type Skill } from '@/lib/data';
import { fetchAllSkills } from '@/lib/storage';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { CALM_EASE } from '@/components/CollapsibleLog';

export function ResumeSection() {
  const [skills, setSkills] = useState<Skill[]>(() => cvSkills);

  useEffect(() => {
    const storedSkills = fetchAllSkills();
    const map = new Map<string, Skill>();
    for (const s of storedSkills) {
      map.set(s.label.toLowerCase(), s);
    }
    setSkills(Array.from(map.values()));
  }, []);

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
              text="Resume"
              className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
            />
          </div>
        </div>

        <div className="section-content-reveal w-full space-y-4 sm:space-y-5">
          <div className="space-y-4 border-t border-line pt-3">
            {/* Top summary & PDF download */}
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="font-sans text-xs sm:text-sm text-ink-muted">
                Work, education, and methods.
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/resume.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 transition-opacity min-h-[36px] max-[759px]:min-h-[44px] inline-flex items-center shrink-0"
              >
                Download PDF ↓
              </a>
            </div>

            {/* WORK */}
            <section
              aria-labelledby="resume-work-heading"
              className="space-y-1.5 border-t border-line pt-3"
            >
              <h2 id="resume-work-heading" className="font-mono text-xs text-ink-muted">
                Work
              </h2>
              <div className="divide-y divide-line">
                {experiences.map((exp, i) => (
                  <div key={i} className="py-2.5 first:pt-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h3 className="font-mono text-xs sm:text-sm font-normal text-ink">
                        {exp.role} <span className="text-ink-muted">· {exp.company}</span>
                      </h3>
                      <span className="font-mono text-[11px] sm:text-xs text-ink-muted shrink-0 tabular-nums">
                        {exp.duration}
                      </span>
                    </div>
                    <p className="font-sans text-xs sm:text-sm text-ink/90 leading-relaxed">
                      {exp.summary}
                    </p>
                    {exp.stack && exp.stack.length > 0 && (
                      <p className="font-mono text-[11px] text-ink-muted leading-relaxed">
                        {exp.stack.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* EDUCATION & SKILLS SIDE-BY-SIDE ON DESKTOP */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-line pt-3">
              {/* EDUCATION */}
              <section aria-labelledby="resume-education-heading" className="space-y-1.5">
                <h2
                  id="resume-education-heading"
                  className="font-mono text-xs text-ink-muted"
                >
                  Education
                </h2>
                <div className="divide-y divide-line">
                  {education.map((edu, i) => (
                    <div key={i} className="py-2.5 first:pt-1 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <h3 className="font-mono text-xs sm:text-sm font-normal text-ink">
                          {edu.degree}
                        </h3>
                        <span className="font-mono text-[11px] text-ink-muted shrink-0 tabular-nums">
                          {edu.duration}
                        </span>
                      </div>
                      <p className="font-sans text-xs sm:text-sm text-ink/90">
                        {edu.school}
                      </p>
                      <p className="font-mono text-[11px] text-ink-muted leading-relaxed">
                        {edu.specialization}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* SKILLS */}
              <section
                aria-labelledby="resume-skills-heading"
                className="space-y-1.5 max-lg:border-t max-lg:border-line max-lg:pt-3"
              >
                <h2 id="resume-skills-heading" className="font-mono text-xs text-ink-muted">
                  Skills
                </h2>
                <div className="divide-y divide-line">
                  {groupedSkills.map(([category, items]) => (
                    <div key={category} className="py-2 first:pt-1 space-y-0.5">
                      <h3 className="font-mono text-[11px] text-ink-muted">{category}</h3>
                      <p className="font-mono text-xs text-ink leading-relaxed">
                        {items.join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </motion.article>
    </MotionConfig>
  );
}
