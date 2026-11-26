import type { Hobby } from '@/content';
import { DOORS, ROOM as LOBBY } from '../lobby/layout';

/**
 * Hobbies room: an "after hours" lounge east of the lobby, entered through
 * the lobby's right-wall door. It shares that wall with the lobby.
 *
 * A big window on the south wall (same side as the lobby's) lets the sun in,
 * so the room changes with the day/night cycle later. Hobbies are displayed
 * along the north and east walls; the middle is a lounge.
 *
 * Units are metres, world coordinates.
 */

const T = LOBBY.wall;
export const DOOR = DOORS.hobbies;

export const ROOM = {
    x0: LOBBY.halfWidth + T, // west inner face = outer face of the shared lobby wall
    x1: LOBBY.halfWidth + T + 11, // east inner face
    z0: -LOBBY.halfDepth,
    z1: LOBBY.halfDepth,
    height: LOBBY.height,
    wall: T,
} as const;

export const CENTER = { x: (ROOM.x0 + ROOM.x1) / 2, z: (ROOM.z0 + ROOM.z1) / 2 } as const;

/** Window in the south wall: x range and sill/head heights. */
export const WINDOW = { x0: ROOM.x0 + 2, x1: ROOM.x1 - 2, y0: 0.55, y1: 3.75 } as const;

type Vec3 = [number, number, number];

export type HobbySpot = {
    hobby: Hobby;
    /** Point on the wall where the display is mounted (y = 0). */
    position: Vec3;
    /** Rotation so the display's front (local +z) faces into the room. */
    rotationY: number;
};

/**
 * Wall spots in visiting order: along the north wall from the door, then
 * down the east wall. Each entry: [x, z, rotationY].
 */
const SPOTS: [number, number, number][] = [
    [ROOM.x0 + 2.7, ROOM.z0, 0],
    [CENTER.x, ROOM.z0, 0],
    [ROOM.x1 - 2.7, ROOM.z0, 0],
    [ROOM.x1, -2.6, -Math.PI / 2],
    [ROOM.x1, 0, -Math.PI / 2],
    [ROOM.x1, 2.6, -Math.PI / 2],
];

/** Assigns hobbies to wall spots in order. Extra hobbies don't fit yet. */
export function layoutHobbies(hobbies: Hobby[]) {
    const spots: HobbySpot[] = hobbies.slice(0, SPOTS.length).map((hobby, i) => {
        const [x, z, rotationY] = SPOTS[i];
        return { hobby, position: [x, 0, z], rotationY };
    });
    return { spots, overflow: hobbies.slice(SPOTS.length) };
}
