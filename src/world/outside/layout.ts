import { companies } from '@/content';
import { roomFor } from '@/world/rooms/career/layout';
import { ROOM as HOBBIES, WINDOW as HOBBIES_WINDOW } from '@/world/rooms/hobbies/layout';
import { ROOM as LOBBY, WINDOW as LOBBY_WINDOW } from '@/world/rooms/lobby/layout';
import { ROOM as PROJECTS } from '@/world/rooms/projects/layout';

/**
 * The world outside the loft: its building's outer shell, the street in
 * front of the windows (south, +z) and the city around it.
 *
 * Everything is derived from the room layouts, so a longer career corridor
 * or a wider room moves the façade and street with it. Units are metres.
 */

const T = LOBBY.wall;
const career = roomFor(companies.length);

/** Outer faces of the building's walls. */
export const SHELL = {
    west: PROJECTS.x0 - T,
    east: HOBBIES.x1 + T,
    south: LOBBY.halfDepth + T,
    north: -LOBBY.halfDepth - T,
    corridorWest: career.x0 - T,
    corridorEast: career.x1 + T,
    corridorNorth: career.z0 - T,
} as const;

/** Window openings in the south façade (the only windows, both facing the street). */
export const SOUTH_WINDOWS = [LOBBY_WINDOW, HOBBIES_WINDOW].map((w) => ({
    from: w.x0,
    to: w.x1,
    y0: w.y0,
    y1: w.y1,
}));

/** Ground level outside: the grass plane (the floor inside is at 0). */
export const GROUND_Y = -0.22;
/** Top of the façade: roof slab plus a low parapet. */
export const ROOF_Y = LOBBY.height + 0.5;

/** The street, as bands along z from the building's front. */
const kerb = SHELL.south + 4.2; // pavement in front of the windows
export const STREET = {
    /** How far the street runs either way along x. */
    halfLength: 80,
    pavementTop: -0.02,
    roadTop: -0.17, // kerbs are 15 cm high
    nearPavement: [SHELL.south, kerb] as const,
    road: [kerb + 0.15, kerb + 0.15 + 7.5] as const,
    farPavement: [kerb + 0.3 + 7.5, kerb + 0.3 + 7.5 + 3.6] as const,
} as const;

/** Where the opposite row of buildings starts (their front faces). */
export const CITY_FRONT = STREET.farPavement[1];
