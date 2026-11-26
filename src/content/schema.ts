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

/** What each line of the "currently" board is about. */
export const CURRENTLY_KINDS = {
    building: 'Building',
    working: 'Working on',
    learning: 'Learning',
    reading: 'Reading',
    playing: 'Playing',
    listening: 'Listening to',
} as const;
export type CurrentlyKind = keyof typeof CURRENTLY_KINDS;

export const CurrentlySchema = z.object({
    /** When you last updated the board (YYYY-MM-DD); shown so visitors know it's fresh. */
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    items: z
        .array(
            z.object({
                kind: z.enum(Object.keys(CURRENTLY_KINDS) as [CurrentlyKind, ...CurrentlyKind[]]),
                /** Short: it's spelled out in letters on the board. */
                title: z.string().min(1).max(32),
                detail: z.string().optional(),
                link: LinkSchema.optional(),
                /** A GitHub repo name: the board then shows when it was last pushed, live. */
                repo: z.string().optional(),
            }),
        )
        .min(1)
        .max(6),
});

export const AboutSchema = z.object({
    name: z.string().min(1),
    headline: z.string().min(1),
    location: z.string().optional(),
    /** A CV file in /public (e.g. "/cv/name.pdf"), offered as "Download CV". */
    cv: z.string().startsWith('/').optional(),
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
/**
 * The lobby bookshelf is a knowledge base: each book is a markdown file in
 * src/content/notes/. Three kinds, which also look different on the shelf.
 */
export const NOTE_KINDS = {
    note: 'Field note', // what I know about a topic and how I approach it (a hardcover)
    case: 'Case file', // one hard problem: context, approach, result (a tall binder)
    til: 'Today I learned', // one small, sharp lesson (a slim notebook)
} as const;
export type NoteKind = keyof typeof NOTE_KINDS;

/** What a note is about; sets the colour of its cover. */
export const NOTE_AREAS = {
    frontend: { label: 'Frontend', color: '#35607d' },
    backend: { label: 'Backend', color: '#5a6b34' },
    ai: { label: 'AI', color: '#6d4483' },
    commerce: { label: 'Ecommerce', color: '#9a6a28' },
    leadership: { label: 'Leadership', color: '#7f3535' },
    craft: { label: 'Craft', color: '#2f6f66' },
} as const;
export type NoteArea = keyof typeof NOTE_AREAS;

const keysOf = <T extends Record<string, unknown>>(o: T) =>
    Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

/** A note's frontmatter (the block between the --- lines at the top of the file). */
export const NoteMetaSchema = z.object({
    /** Printed on the spine, so keep it short. */
    title: z.string().min(1).max(34),
    kind: z.enum(keysOf(NOTE_KINDS)),
    area: z.enum(keysOf(NOTE_AREAS)),
    /** One line: shown under the title and in lists. */
    summary: z.string().min(1).max(180),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

export type Skill = z.infer<typeof SkillSchema>;
export type Currently = z.infer<typeof CurrentlySchema>;
