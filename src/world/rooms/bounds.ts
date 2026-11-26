import { companies } from '@/content';
import { roomFor as careerRoom } from './career/layout';
import { ROOM as HOBBIES } from './hobbies/layout';
import { ROOM as LOBBY } from './lobby/layout';
import { ROOM as PROJECTS } from './projects/layout';

/**
 * The floor-plan rectangle that contains every built room (walls included).
 * Lighting uses it to size the sun's shadow box, so it grows automatically
 * when a room grows (e.g. a longer career corridor).
 */
const career = careerRoom(companies.length);
const t = LOBBY.wall;

export const WORLD_BOUNDS = {
    minX: Math.min(-LOBBY.halfWidth, PROJECTS.x0, career.x0, HOBBIES.x0) - t,
    maxX: Math.max(LOBBY.halfWidth, PROJECTS.x1, career.x1, HOBBIES.x1) + t,
    minZ: Math.min(-LOBBY.halfDepth, PROJECTS.z0, career.z0, HOBBIES.z0) - t,
    maxZ: Math.max(LOBBY.halfDepth, PROJECTS.z1, career.z1, HOBBIES.z1) + t,
} as const;
