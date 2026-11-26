import { z } from 'zod';
import * as raw from './data';
import {
    AboutSchema,
    CompanySchema,
    CurrentlySchema,
    HobbySchema,
    ProjectSchema,
    SkillSchema,
} from './schema';

/** Validated content. Import from here, never from ./data directly. */
export const about = AboutSchema.parse(raw.about);
export const projects = z
    .array(ProjectSchema)
    .parse(raw.projects)
    .sort((a, b) => b.year - a.year);
export const companies = z
    .array(CompanySchema)
    .parse(raw.companies)
    .sort((a, b) => b.start.localeCompare(a.start));
export const hobbies = z.array(HobbySchema).parse(raw.hobbies);
export const skills = z.array(SkillSchema).parse(raw.skills);
export const currently = CurrentlySchema.parse(raw.currently);

// Every skill a project or role lists must be in the catalogue: a typo like
// "nextj" would otherwise quietly become a separate, lonely star.
const known = new Set(skills.map((s) => s.slug));
const unknown = [...projects, ...companies].flatMap((x) =>
    x.skills.filter((s) => !known.has(s)).map((s) => `"${s}" (in ${x.slug})`),
);
if (unknown.length > 0) {
    throw new Error(`Unknown skills; add them to "skills" in data.ts: ${unknown.join(', ')}`);
}

const skillBySlug = new Map(skills.map((s) => [s.slug, s]));
/** Display name for a skill slug, e.g. "nextjs" -> "Next.js". */
export function skillName(slug: string) {
    return skillBySlug.get(slug)?.name ?? slug;
}

/** The projects and roles that list a skill. */
export function skillUsage(slug: string) {
    return {
        projects: projects.filter((p) => p.skills.includes(slug)),
        companies: companies.filter((c) => c.skills.includes(slug)),
    };
}

export type {
    About,
    Company,
    Currently,
    CurrentlyKind,
    Hobby,
    NoteArea,
    NoteKind,
    Project,
    Skill,
    SkillCategory,
} from './schema';
export { CURRENTLY_KINDS, NOTE_AREAS, NOTE_KINDS, SKILL_CATEGORIES } from './schema';
export { noteBySlug, notes, type Note } from './notes';

export function formatRange(start: string, end: string | null) {
    const fmt = (ym: string) => {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
    };
    return `${fmt(start)} – ${end ? fmt(end) : 'Present'}`;
}
