import { MARKERS } from '@/world/rooms/lobby/layout';

/**
 * The AI kiosk's shape: a slim steel stand with a screen tipped back like a
 * lectern, in the lobby's centre spot, under the pendant lamp. Its own
 * frame: metres, floor at y = 0, the screen facing +z. It's turned to face
 * the entrance (+x in the world).
 */

export const KIOSK = {
    position: MARKERS.centrepiece.position,
    rotationY: Math.PI / 2,
    /** The head: the slab the screen is set into, its centre height, and how far it tips back. */
    head: { width: 0.74, height: 0.5, depth: 0.06, y: 1.16, tilt: 0.5 },
    glass: { width: 0.66, height: 0.42 },
};

const { head, glass } = KIOSK;
const [x, , z] = KIOSK.position;
/** The glass sits just in front of the head's face, along its tipped normal. */
const out = head.depth / 2 + 0.003;
const along = Math.cos(head.tilt) * out; // forward, in the kiosk's frame
const up = Math.sin(head.tilt) * out;

/** The glass in the world, for the seat that frames it (see seats.ts). */
export const KIOSK_SCREEN = {
    center: [
        x + Math.sin(KIOSK.rotationY) * along,
        head.y + up,
        z + Math.cos(KIOSK.rotationY) * along,
    ] as [number, number, number],
    rotationY: KIOSK.rotationY,
    tiltUp: head.tilt,
    width: glass.width,
    height: glass.height,
};
