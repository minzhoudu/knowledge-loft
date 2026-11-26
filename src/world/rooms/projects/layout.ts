import type { Project } from '@/content';
import { DOORS, ROOM as LOBBY } from '../lobby/layout';

/**
 * Projects room: a gallery west of the lobby, entered through the lobby's
 * left-wall doorway. It shares that wall with the lobby, so its east edge is
 * the wall's outer face.
 *
 * Units are metres, world coordinates (same axes as the lobby).
 */

const T = LOBBY.wall;

export const ROOM = {
    x0: -19.3, // west inner face
    x1: -LOBBY.halfWidth - T, // east inner face = outer face of the shared lobby wall
    z0: -LOBBY.halfDepth,
    z1: LOBBY.halfDepth,
    height: LOBBY.height,
    wall: T,
} as const;

export const CENTER = { x: (ROOM.x0 + ROOM.x1) / 2, z: (ROOM.z0 + ROOM.z1) / 2 } as const;

export const DOOR = DOORS.projects; // centred at z = DOOR.center on the east wall

type Vec3 = [number, number, number];

export type ExhibitSlot = {
    project: Project;
    position: Vec3; // where the plinth stands on the floor
    rotationY: number; // which way the exhibit faces (its front is local +z)
};

/** Exhibits along each long wall, from the door end to the far end. */
const ROW_X = [-8.9, -11.8, -14.8, -17.7];
const ROW_INSET = 0.9; // distance of plinths from the wall

/**
 * Turns the project list into positions. This is the core idea of a
 * data-driven room: add a project to content/data.ts and an exhibit appears,
 * no 3D code changes needed.
 *
 * The featured project gets the centre podium, facing the door. The rest fill
 * the north and south walls alternately, nearest the door first, so the first
 * things you see are the most recent projects (content is sorted by year).
 */
export function layoutExhibits(projects: Project[]) {
    const featured = projects.find((p) => p.featured) ?? null;
    const rest = projects.filter((p) => p !== featured);

    const capacity = ROW_X.length * 2;
    const slots: ExhibitSlot[] = rest.slice(0, capacity).map((project, i) => {
        const north = i % 2 === 0;
        const x = ROW_X[Math.floor(i / 2)];
        return {
            project,
            position: [x, 0, north ? ROOM.z0 + ROW_INSET : ROOM.z1 - ROW_INSET],
            rotationY: north ? 0 : Math.PI, // north row faces +z (into the room), south row faces -z
        };
    });

    return {
        featured,
        slots,
        // Projects that didn't fit. The room will need to grow (or get a second
        // floor) before this is non-empty; the panel lists them all meanwhile.
        overflow: rest.slice(capacity),
    };
}
