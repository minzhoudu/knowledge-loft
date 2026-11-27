import type { SkillCategory } from '@/content';

/**
 * Each skill family's colour: the constellation's stars in 3D, and the
 * same families on the quick view, so the two read as one design.
 * Bright on purpose (they glow on a dark sky).
 */
export const SKILL_COLORS: Record<SkillCategory, string> = {
    language: '#f2c14e',
    frontend: '#5ec8f2',
    backend: '#7ee08a',
    data: '#c79bff',
    devops: '#ff9f6b',
    ai: '#ff6fa8',
    commerce: '#9ad1c3',
};
