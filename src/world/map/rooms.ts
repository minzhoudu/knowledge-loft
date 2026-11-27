import { companies } from '@/content';
import { roomFor } from '@/world/rooms/career/layout';
import { ROOM as HOBBIES } from '@/world/rooms/hobbies/layout';
import { DOORS, MARKERS, ROOM as LOBBY } from '@/world/rooms/lobby/layout';
import { ROOM as PROJECTS } from '@/world/rooms/projects/layout';
import type { RoomId } from '@/world/rooms/zones';

/**
 * The rooms as the map sees them: a floor rectangle to highlight and click,
 * a label, and where you arrive when you jump in (just inside the door from
 * the lobby, facing into the room).
 *
 * Yaw is the camera's rotation about y: 0 looks toward -z (north), π/2
 * toward -x (west), -π/2 toward +x (east).
 */
export type MapRoom = {
    label: string;
    hint: string;
    /** Floor rectangle: x0, z0, x1, z1. */
    rect: [number, number, number, number];
    entry: { x: number; z: number; yaw: number };
};

const career = roomFor(companies.length);
const INSIDE = 1.3; // how far past the door you arrive

export const MAP_ROOMS: Record<RoomId, MapRoom> = {
    lobby: {
        label: 'Lobby',
        hint: 'About, an AI kiosk, field notes, an arcade',
        rect: [-LOBBY.halfWidth, -LOBBY.halfDepth, LOBBY.halfWidth, LOBBY.halfDepth],
        entry: {
            x: MARKERS.spawn.position[0],
            z: MARKERS.spawn.position[2],
            yaw: MARKERS.spawn.yaw,
        },
    },
    projects: {
        label: 'Projects',
        hint: 'Exhibits and live GitHub',
        rect: [PROJECTS.x0, PROJECTS.z0, PROJECTS.x1, PROJECTS.z1],
        entry: { x: PROJECTS.x1 - INSIDE, z: DOORS.projects.center, yaw: Math.PI / 2 },
    },
    career: {
        label: 'Career',
        hint: 'A walk back through time',
        rect: [career.x0, career.z0, career.x1, career.z1],
        entry: { x: DOORS.career.center, z: career.z1 - INSIDE, yaw: 0 },
    },
    hobbies: {
        label: 'Hobbies',
        hint: 'After hours',
        rect: [HOBBIES.x0, HOBBIES.z0, HOBBIES.x1, HOBBIES.z1],
        entry: { x: HOBBIES.x0 + INSIDE, z: DOORS.hobbies.center, yaw: -Math.PI / 2 },
    },
};

export const ROOM_IDS = Object.keys(MAP_ROOMS) as RoomId[];
