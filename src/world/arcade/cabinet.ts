import { MARKERS } from '@/world/rooms/lobby/layout';

/**
 * The arcade cabinet's shape, in its own frame: metres, the floor at y = 0,
 * the player side toward +z, centred on x. Lobby.tsx stands it at
 * MARKERS.arcade, turned by its rotationY.
 *
 * The whole body is one side profile, a polygon in the (z, y) plane, pushed
 * out sideways (extruded) to the cabinet's width. That's how real cabinets
 * are built too: two plywood sides cut to this outline, with panels between
 * them. Everything on the front (screen, control panel, marquee, coin door)
 * sits on one of the profile's edges, so it's all derived from these points.
 */

export type P = [z: number, y: number];

export const WIDTH = 0.66;
/** The side panels, a little proud of the body, with the edge trim (T-moulding) on them. */
export const SIDE = 0.018;

export const POINT = {
    backBottom: [-0.42, 0] as P,
    frontBottom: [0.3, 0] as P,
    /** Top of the front panel with the coin door. */
    kickTop: [0.3, 0.8] as P,
    /** The control panel juts out toward you and tips up toward the screen. */
    panelLip: [0.47, 0.9] as P,
    panelFront: [0.47, 0.96] as P,
    panelBack: [0.2, 1.02] as P,
    /** The screen's bezel, leaning back like a drafting table. */
    screenBottom: [0.18, 1.07] as P,
    screenTop: [0.02, 1.62] as P,
    /** The marquee (the lit sign) overhangs the screen like a peaked cap. */
    marqueeBottom: [0.2, 1.67] as P,
    marqueeTop: [0.2, 1.9] as P,
    backTop: [-0.3, 1.9] as P,
    backShoulder: [-0.42, 1.74] as P,
} as const;

/** The outline, counter-clockwise (as three.js Shape expects for a solid). */
export const PROFILE: P[] = [
    POINT.backBottom,
    POINT.frontBottom,
    POINT.kickTop,
    POINT.panelLip,
    POINT.panelFront,
    POINT.panelBack,
    POINT.screenBottom,
    POINT.screenTop,
    POINT.marqueeBottom,
    POINT.marqueeTop,
    POINT.backTop,
    POINT.backShoulder,
];

/**
 * A flat face along one edge of the profile, from `a` to `b`: its middle
 * (moved `out` metres off the surface), its length, and its tilt: the
 * rotation about x that turns a plane facing +z to lie on this edge.
 * Negative tips it to face up a little, like the screen.
 */
export function face(a: P, b: P, out = 0) {
    const dz = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dz, dy);
    // Outward normal of an edge on a counter-clockwise outline: the edge
    // direction turned a quarter-turn clockwise.
    const nz = dy / length;
    const ny = -dz / length;
    return {
        z: (a[0] + b[0]) / 2 + nz * out,
        y: (a[1] + b[1]) / 2 + ny * out,
        length,
        /** Rotation about x that turns a +z-facing plane to face along the normal. */
        tilt: -Math.atan2(ny, nz),
    };
}

export const SCREEN_FACE = face(POINT.screenBottom, POINT.screenTop);
/** The glass sits just proud of the bezel. */
export const GLASS_AT = face(POINT.screenBottom, POINT.screenTop, 0.008);
export const PANEL_FACE = face(POINT.panelFront, POINT.panelBack);
export const MARQUEE_FACE = face(POINT.marqueeBottom, POINT.marqueeTop);
export const KICK_FACE = face(POINT.frontBottom, POINT.kickTop);

/** The picture tube's glass: portrait, 3:4, like the vertical games of the early '80s. */
export const GLASS = { width: 0.375, height: 0.5 };
/** Pixels of the game, drawn 1:1 into a canvas (see game.ts). */
export const PIXELS = { width: 240, height: 320 };

const { position: at, rotationY } = MARKERS.arcade;

/** The glass in the world, for the seat that frames it (see seats.ts). */
export const ARCADE_SCREEN = {
    // The cabinet's local +z turned by rotationY: (sin, cos) on the floor.
    center: [
        at[0] + Math.sin(rotationY) * GLASS_AT.z,
        GLASS_AT.y,
        at[2] + Math.cos(rotationY) * GLASS_AT.z,
    ] as [number, number, number],
    rotationY,
    /** How far it faces upward. */
    tiltUp: -SCREEN_FACE.tilt,
    width: GLASS.width,
    height: GLASS.height,
};
