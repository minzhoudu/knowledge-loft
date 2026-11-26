import { z } from 'zod';

/**
 * Content schemas: the single source of truth for everything about you.
 * The 3D world, the 2D quick view and (later) the AI assistant all read
 * content through these types, so a typo or a missing field fails loudly
 * at build time instead of showing up as a blank panel in the world.
 */

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM, e.g. 2024-03');

export const LinkSchema = z.object({
    label: z.string().min(1),
    href: z.url(),
});

export const ProjectSchema = z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    summary: z.string().min(1),
    year: z.number().int().min(1990).max(2100),
    /** Skill slugs. Powers the skill constellation (feature 7). */
    skills: z.array(z.string()).default([]),
    links: z.array(LinkSchema).default([]),
    featured: z.boolean().default(false),
});

export const CompanySchema = z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    role: z.string().min(1),
    start: yearMonth,
    /** null = current job. Dates let the career corridor lay itself out (feature 6). */
    end: yearMonth.nullable(),
    summary: z.string().min(1),
    skills: z.array(z.string()).default([]),
});

export const HobbySchema = z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    summary: z.string().min(1),
});

/** Skill families: each gets its own colour and region in the constellation. */
export const SKILL_CATEGORIES = {
    language: 'Languages',
    frontend: 'Frontend & mobile',
    backend: 'Backend & APIs',
    data: 'Data',
    devops: 'Cloud & DevOps',
    ai: 'AI & LLMs',
    commerce: 'Ecommerce & integrations',
} as const;
export type SkillCategory = keyof typeof SKILL_CATEGORIES;

export const SkillSchema = z.object({
    /** What projects and roles list in their `skills`, e.g. "nextjs". */
    slug: z.string().regex(/^[a-z0-9-]+$/),
    /** How it's shown, e.g. "Next.js". */
    name: z.string().min(1),
    category: z.enum(Object.keys(SKILL_CATEGORIES) as [SkillCategory, ...SkillCategory[]]),
});

export const AboutSchema = z.object({
    name: z.string().min(1),
    headline: z.string().min(1),
    location: z.string().optional(),
    /**
     * IANA time zone of the studio, e.g. "Europe/Belgrade". Drives live
     * day/night lighting. Checked against the browser's list of zones.
     */
    timeZone: z
        .string()
        .refine((tz) => {
            try {
                new Intl.DateTimeFormat('en', { timeZone: tz });
                return true;
            } catch {
                return false;
            }
        }, 'Unknown time zone; use an IANA name like "Europe/Belgrade"')
        .optional(),
    /**
     * Where the studio is. Drives the real sun path (day length changes with
     * latitude and season) and live weather. City-level precision is plenty.
     */
    coordinates: z
        .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
        .optional(),
    bio: z.string().min(1),
    links: z.array(LinkSchema).default([]),
    /** GitHub username: powers the live GitHub wall in the Projects gallery. */
    github: z
        .string()
        .regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i, 'Not a valid GitHub username')
        .optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Hobby = z.infer<typeof HobbySchema>;
export type About = z.infer<typeof AboutSchema>;
export type Skill = z.infer<typeof SkillSchema>;
