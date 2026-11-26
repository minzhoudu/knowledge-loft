import type { Company } from '@/content';
import { DOORS, ROOM as LOBBY } from '../lobby/layout';

/**
 * Career room: a timeline corridor running north (-z) from the lobby's back
 * doorway. Walking away from the lobby walks back in time: your current role
 * is by the door, your first one at the far end.
 *
 * The corridor's length comes from the number of roles, so it grows with
 * your career. Units are metres, world coordinates.
 */

const T = LOBBY.wall;
export const DOOR = DOORS.career;

const START = 3; // open floor between the door and the first station
const SPACING = 4.5; // distance between stations
const END = 3.5; // room after the last station
const MIN_LENGTH = 10;

export function corridorLength(count: number) {
    return Math.max(MIN_LENGTH, START + Math.max(count - 1, 0) * SPACING + END);
}

export function roomFor(count: number) {
    const z1 = -LOBBY.halfDepth - T; // south inner face = outer face of the lobby's back wall
    return {
        x0: 3.0, // west inner face
        x1: 7.0, // east inner face (stays within the lobby wall's span)
        z1,
        z0: z1 - corridorLength(count), // north inner face (far end)
        height: LOBBY.height,
        wall: T,
    } as const;
}

export type CareerRoomShape = ReturnType<typeof roomFor>;

export type Station = {
    company: Company;
    /** Point on the wall where the station is mounted (y = 0). */
    position: [number, number, number];
    /** Rotation so the station's front (local +z) faces into the corridor. */
    rotationY: number;
    side: 'west' | 'east';
};

/**
 * One station per role, alternating walls so they don't crowd one side.
 * `companies` is already sorted newest first, so index 0 is nearest the door.
 */
export function layoutStations(companies: Company[], room: CareerRoomShape): Station[] {
    return companies.map((company, i) => {
        const west = i % 2 === 0;
        return {
            company,
            position: [west ? room.x0 : room.x1, 0, room.z1 - START - i * SPACING],
            rotationY: west ? Math.PI / 2 : -Math.PI / 2,
            side: west ? 'west' : 'east',
        };
    });
}
