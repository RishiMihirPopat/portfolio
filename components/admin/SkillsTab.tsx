'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { Skill } from '@/lib/data';
import { TACTILE_SPRING } from '@/components/CollapsibleLog';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BTN_CLASS,
} from '@/components/admin/shared';

interface SkillsTabProps {
  skills: Skill[];
  skillCategories: string[];
  newSkillLabel: string;
  newSkillCategory: string;
  onNewSkillLabelChange: (value: string) => void;
  onNewSkillCategoryChange: (value: string) => void;
  onAddSkill: (e: React.FormEvent) => void;
  onDeleteSkill: (label: string) => void;
}

export function SkillsTab({
  skills,
  skillCategories,
  newSkillLabel,
  newSkillCategory,
  onNewSkillLabelChange,
  onNewSkillCategoryChange,
  onAddSkill,
  onDeleteSkill,
}: SkillsTabProps) {
  return (
    <div className="space-y-6">
      <form
        onSubmit={onAddSkill}
        aria-label="Add skill"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="skill-label" className={LABEL_CLASS}>
            Skill
          </label>
          <input
            id="skill-label"
            name="skillLabel"
            type="text"
            value={newSkillLabel}
            onChange={(e) => onNewSkillLabelChange(e.target.value)}
            className={INPUT_CLASS}
            placeholder="e.g. Stan"
            required
          />
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="skill-category" className={LABEL_CLASS}>
            Category
          </label>
          <select
            id="skill-category"
            name="skillCategory"
            value={newSkillCategory}
            onChange={(e) => onNewSkillCategoryChange(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}
          >
            {skillCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <motion.button
            type="submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={TACTILE_SPRING}
            className={PRIMARY_BTN_CLASS}
          >
            Add skill
          </motion.button>
        </div>
      </form>

      <LayoutGroup id="admin-skills-groups">
        <div className="divide-y divide-line border-t border-line">
          {skillCategories.map((cat) => {
            const catSkills = skills.filter((s) => s.category === cat);
            return (
              <section key={cat} className="py-3.5 space-y-2.5">
                <h2 className="font-mono text-xs text-ink-muted">{cat}</h2>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {catSkills.map((skill) => (
                      <motion.span
                        key={skill.label}
                        layout
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.84 }}
                        transition={TACTILE_SPRING}
                        className="inline-flex items-center gap-1 border border-line-control bg-surface/85 pl-2.5 pr-0.5 font-mono text-xs text-ink rounded-[2px]"
                      >
                        <span>{skill.label}</span>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.88 }}
                          onClick={() => onDeleteSkill(skill.label)}
                          aria-label={`Remove ${skill.label}`}
                          className="text-ink-muted hover:text-danger min-w-[28px] min-h-[28px] inline-flex items-center justify-center cursor-pointer transition-colors"
                        >
                          ×
                        </motion.button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {catSkills.length === 0 && (
                    <span className="font-sans text-xs text-ink-muted">
                      No skills in this category.
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
