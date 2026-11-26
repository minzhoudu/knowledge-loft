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

export const AboutSchema = z.object({
    name: z.string().min(1),
    headline: z.string().min(1),
    location: z.string().optional(),
    bio: z.string().min(1),
    links: z.array(LinkSchema).default([]),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Hobby = z.infer<typeof HobbySchema>;
export type About = z.infer<typeof AboutSchema>;
