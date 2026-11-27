import { notes } from '@/content';
import { MARKERS, ROOM } from '@/world/rooms/lobby/layout';
import { layoutShelf, SPINE_Z } from './layout';

/**
 * Where the shelf stands, and the view you get when you step up to it.
 *
 * At the shelf you don't turn your head, you slide: the view always faces
 * the shelf square on (the shelf's +z is toward the room, so facing it is
 * camera yaw 0), and moving the mouse slides it along the rows and up and
 * down. Turning, the books at the ends sat 40°+ to the side: past where
 * the view could reach, and seen edge-on as slivers. Sliding, every spine
 * is seen head-on, and the slide stops exactly at the outermost books'
 * centres, so the crosshair can reach each one.
 */

type Vec3 = [number, number, number];

/** The shelf model's origin: on the floor, centred, its back against the brick. */
export const SHELF_POSITION: Vec3 = [MARKERS.shelf.position[0], 0, -ROOM.halfDepth + 0.38];

const [sx, , sz] = SHELF_POSITION;
/**
 * How far back from the spines you stand: close enough to read them. A
 * 65° field of view sees about 1.3 m of shelf top to bottom from here,
 * nearly all of the rows; sliding covers the rest.
 */
const BACK = 1.0;

// Where the books are: the slide's limits are the outermost books' centres.
const { books } = layoutShelf(notes);
const xs = books.map((b) => b.position[0]);
const ys = books.map((b) => b.position[1]);

export const BROWSE = {
    /** Distance of the eye from the shelf's origin, along z (world). */
    z: sz + SPINE_Z + BACK,
    /** Where the slide may go, in world x and y (eye positions). */
    x: [sx + Math.min(...xs), sx + Math.max(...xs)] as const,
    y: [Math.min(...ys), Math.max(...ys)] as const,
    /** Where you arrive: the middle of the shelf, level with the eye-height rows. */
    start: [sx, 1.3] as const,
    yaw: 0,
    /** Mouse to slide: about the same feel as turning at this distance (0.002 rad/px). */
    metresPerRadian: BACK,
    /** WASD / joystick slide speed, metres per second. */
    speed: 0.9,
};
