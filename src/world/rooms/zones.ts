import { companies } from '@/content';
import { roomFor as careerRoom } from './career/layout';
import { ROOM as HOBBIES, WINDOW as HOBBIES_WINDOW } from './hobbies/layout';
import { DOORS, ROOM as LOBBY, WINDOW as LOBBY_WINDOW } from './lobby/layout';
import { ROOM as PROJECTS } from './projects/layout';

/**
 * Which room a point is in, and where doors and windows are, from the
 * rooms' layout contracts. Used by audio (room ambience, door sounds,
 * weather heard through the windows).
 */

export type RoomId = 'lobby' | 'projects' | 'career' | 'hobbies';

type Rect = { x0: number; x1: number; z0: number; z1: number };

const career = careerRoom(companies.length);
const t = LOBBY.wall;

// Each room's floor, stretched over half its doorway walls so standing in a
// doorway counts as being in one room or the other, never neither.
const RECTS: Record<RoomId, Rect> = {
    lobby: {
        x0: -LOBBY.halfWidth,
        x1: LOBBY.halfWidth,
        z0: -LOBBY.halfDepth,
        z1: LOBBY.halfDepth,
    },
    projects: { x0: PROJECTS.x0, x1: PROJECTS.x1 + t / 2, z0: PROJECTS.z0, z1: PROJECTS.z1 },
    career: { x0: career.x0, x1: career.x1, z0: career.z0, z1: career.z1 + t / 2 },
    hobbies: { x0: HOBBIES.x0 - t / 2, x1: HOBBIES.x1, z0: HOBBIES.z0, z1: HOBBIES.z1 },
};

export function roomAt(x: number, z: number): RoomId | null {
    for (const id of Object.keys(RECTS) as RoomId[]) {
        const r = RECTS[id];
        if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return id;
    }
    return null;
}

/** Store id of the door between the lobby and a room (see Lobby.tsx). */
export function doorBetween(a: RoomId, b: RoomId): string | null {
    if (a === b) return null;
    if (a === 'lobby') return `lobby-${b}`;
    if (b === 'lobby') return `lobby-${a}`;
    return null; // rooms only connect through the lobby
}

/** Centre of each lobby door, at handle height. */
const DOOR_Y = 1.1;
export const DOOR_POSITIONS: Record<string, [number, number, number]> = {
    'lobby-projects': [-LOBBY.halfWidth - t / 2, DOOR_Y, DOORS.projects.center],
    'lobby-career': [DOORS.career.center, DOOR_Y, -LOBBY.halfDepth - t / 2],
    'lobby-hobbies': [LOBBY.halfWidth + t / 2, DOOR_Y, DOORS.hobbies.center],
};

/** Just outside the middle of each south window: where outdoor sound comes in. */
const OUTSIDE = LOBBY.halfDepth + t + 1;
export const WINDOW_POSITIONS: [number, number, number][] = [
    [(LOBBY_WINDOW.x0 + LOBBY_WINDOW.x1) / 2, 2, OUTSIDE],
    [(HOBBIES_WINDOW.x0 + HOBBIES_WINDOW.x1) / 2, 2, OUTSIDE],
];
