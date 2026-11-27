import { MARKERS, ROOM } from '@/world/rooms/lobby/layout';

/**
 * The CV printer: a compact laser printer on a low steel cabinet, just left
 * of the desk (About me), its back to the brick. Metres, world frame; the
 * printer faces +z, into the room.
 */

type Vec3 = [number, number, number];

const [dx] = MARKERS.desk.position;
const CABINET_SIZE: Vec3 = [0.52, 0.62, 0.46];
const BACK_WALL = -ROOM.halfDepth;

export const CABINET = {
    size: CABINET_SIZE,
    /** Centre of its footprint, on the floor; a hand's width clear of the wall. */
    position: [dx - 1.48, 0, BACK_WALL + 0.04 + CABINET_SIZE[2] / 2] as Vec3,
};

/**
 * The printer's own frame: origin at the middle of its base, front at +z.
 * A box body with a raised hump across the back (the toner cover); paper
 * comes out of a slot in the hump's front face and lies on the body's top,
 * which is the output tray.
 */
export const PRINTER = {
    position: [CABINET.position[0], CABINET_SIZE[1], CABINET.position[2] + 0.03] as Vec3,
    width: 0.42,
    depth: 0.36,
    /** Top of the body: the tray the sheet lies on. */
    tray: 0.17,
    /** The hump runs from the back to here (z), up to `top`. */
    humpFront: -0.05,
    top: 0.25,
};

/** A4, in metres: the printed sheet. */
export const SHEET = { width: 0.21, length: 0.297 };

/** The first page of the CV, as a picture (scripts/cv-preview.py makes it). */
export const CV_PAGE = '/cv/cv-page-1.jpg';
