import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { companies, projects } from '@/content';

/**
 * The kiosk's tools: ways for the model to *do* something instead of only
 * answering, here, taking the visitor somewhere in the loft.
 *
 * Tool use works like this. Each tool is described to the model with a name,
 * a description (which says *when* to use it) and a JSON Schema for its
 * input. When a question calls for one, the model stops writing and answers
 * with a tool_use block instead: "call show_project with {project:
 * 'moj-vulkanizer'}". Our code runs it, replies with a tool_result, and the
 * model carries on, now knowing it worked. The model never runs anything
 * itself; it can only ask.
 *
 * These tools act in the visitor's browser (the camera flies there), so the
 * server doesn't "run" them: it checks the input, passes the action down to
 * the browser in the response stream, and tells the model it's done.
 *
 * Inputs are fixed lists (enums) of real rooms, projects and roles, so the
 * model can't send anyone to a place that doesn't exist. They're still
 * checked here before anything happens: a model's output is untrusted input
 * like any other.
 */

export const ROOMS = ['lobby', 'projects', 'career', 'hobbies'] as const;
const PROJECTS = projects.map((p) => p.slug) as [string, ...string[]];
const ROLES = companies.map((c) => c.slug) as [string, ...string[]];

/** What the browser is told to do (one per answer at most). */
export type KioskAction =
    | { kind: 'room'; id: (typeof ROOMS)[number] }
    | { kind: 'project'; id: string }
    | { kind: 'role'; id: string };

const NOT_ASKED =
    'Only when the visitor asks to go somewhere, or to be shown something (e.g. "take me there", "show me", "where is"). Never on your own initiative.';

/**
 * Sent to the API with every request. Kept in a fixed order with fixed text:
 * tools come first in the prompt, so they're part of the cached prefix, and
 * any change here would make the next request a cache miss.
 */
export const TOOLS: Anthropic.Tool[] = [
    {
        name: 'go_to_room',
        description: `Take the visitor to a room of the loft: the lobby (About, notes, skills, the arcade), the Projects gallery, the Career corridor, or the Hobbies lounge. ${NOT_ASKED}`,
        eager_input_streaming: true,
        input_schema: {
            type: 'object',
            properties: { room: { type: 'string', enum: [...ROOMS] } },
            required: ['room'],
        },
    },
    {
        name: 'show_project',
        description: `Take the visitor to a project's exhibit in the Projects gallery. Use this for "exhibit", "project" or anything they built. Projects: ${projects
            .map((p) => `${p.slug} = ${p.title}`)
            .join('; ')}. ${NOT_ASKED}`,
        eager_input_streaming: true,
        input_schema: {
            type: 'object',
            properties: { project: { type: 'string', enum: PROJECTS } },
            required: ['project'],
        },
    },
    {
        name: 'show_role',
        description: `Take the visitor to a job's station in the Career corridor. Use this for a job, role or employer, not for an exhibit (exhibits are projects: see show_project). Roles: ${companies
            .map((c) => `${c.slug} = ${c.role} at ${c.name}`)
            .join('; ')}. ${NOT_ASKED}`,
        eager_input_streaming: true,
        input_schema: {
            type: 'object',
            properties: { role: { type: 'string', enum: ROLES } },
            required: ['role'],
        },
    },
];

const Inputs = {
    go_to_room: z.object({ room: z.enum(ROOMS) }),
    show_project: z.object({ project: z.enum(PROJECTS) }),
    show_role: z.object({ role: z.enum(ROLES) }),
};

/** A tool call turned into an action, or null if it's not a valid one. */
export function toAction(name: string, input: unknown): KioskAction | null {
    if (name === 'go_to_room') {
        const r = Inputs.go_to_room.safeParse(input);
        return r.success ? { kind: 'room', id: r.data.room } : null;
    }
    if (name === 'show_project') {
        const r = Inputs.show_project.safeParse(input);
        return r.success ? { kind: 'project', id: r.data.project } : null;
    }
    if (name === 'show_role') {
        const r = Inputs.show_role.safeParse(input);
        return r.success ? { kind: 'role', id: r.data.role } : null;
    }
    return null;
}
