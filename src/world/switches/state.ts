import { useWorld } from '@/store/world';
import { smoothstep } from '@/world/environment/sun';
import { environment } from '@/world/environment/time';
import type { RoomId } from '@/world/rooms/zones';

/**
 * Light switches and blinds: what each room's switches say, and how far
 * along their animations are.
 *
 * Every room starts with its lamps switched on (see the store's defaults).
 * A room left without a switch setting follows an automatic rule instead:
 * rooms with windows light up at dusk, windowless ones (the gallery, the
 * corridor) are always lit.
 *
 * The store holds what the switches say (React needs that for the prompt);
 * the animated values below (how bright each room's lamps are right now,
 * how far each blind has come down) live at module scope, written by the
 * render loop and read by lamps, blinds and the ambient light.
 */

/** Rooms with no windows: their lamps are on by default, day and night. */
const WINDOWLESS = new Set<RoomId>(['projects', 'career']);
/** Rooms with blinds on their windows. */
export const BLIND_ROOMS = ['lobby', 'hobbies'] as const satisfies RoomId[];

/** How dark it's getting, as a lamp sees it: 0 by day, 1 at night (on below ~40% daylight, fully at ~10%). */
export function dusk() {
    return 1 - smoothstep(0.1, 0.4, environment.daylight);
}

/** How lit a room's lamps would be on automatic, 0..1 (follows the dusk for rooms with windows). */
export function autoLights(room: RoomId) {
    return WINDOWLESS.has(room) ? 1 : dusk();
}

/** Where a room's lamps should be heading, 0..1: the switch if it's been used, else automatic. */
export function lightsTarget(room: RoomId) {
    const override = useWorld.getState().lights[room];
    return override === undefined ? autoLights(room) : override ? 1 : 0;
}

/** Are a room's lamps on, as far as its switch is concerned? */
export function lightsOn(room: RoomId) {
    return lightsTarget(room) > 0.5;
}

/**
 * Per room: how far the blinds are down right now (0 = rolled up, 1 = closed).
 * They start down, matching the store's defaults, so they don't roll down
 * in front of you as the world appears.
 */
export const blindDrop: Record<RoomId, number> = { lobby: 1, projects: 0, career: 0, hobbies: 1 };
