/**
 * The lobby's "layout contract": room dimensions and marker positions.
 *
 * Everything gameplay-related (colliders, spawn point, where exhibits sit)
 * comes from here, never from the visual models. Later these markers will be
 * read from named empties in the Blender file (e.g. `marker_projects`), so a
 * new art pass can move things without touching code.
 *
 * Units are metres. Axes: +x right, +y up, +z toward the windows.
 */

export const ROOM = {
    halfWidth: 7, // x: -7..7
    halfDepth: 5, // z: -5..5
    height: 4.2,
    wall: 0.3, // wall thickness
} as const;

export const WINDOW = { x0: -5.6, x1: 5.6, y0: 0.55, y1: 3.75 } as const;

export const DOORS = {
    // `built: false` = the room behind doesn't exist yet, so the doorway is blocked.
    // Built rooms get a real door that the player opens and closes.
    projects: { wall: 'left', center: 1.6, width: 1.3, height: 2.4, built: true },
    career: { wall: 'back', center: 5.4, width: 1.3, height: 2.4, built: true },
    hobbies: { wall: 'right', center: -2.0, width: 1.3, height: 2.4, built: true },
} as const;

type Vec3 = [number, number, number];

export const MARKERS = {
    spawn: { position: [4.8, 1, 0.4] as Vec3, yaw: 0.93 },
    plinth: { position: [-1.4, 0, 0.6] as Vec3 },
    desk: { position: [-4.3, 0, -4.05] as Vec3 },
    shelf: { position: [1.6, 0, -4.79] as Vec3 },
    /** The Career wall display's bezel (2.36 x 1.38 m, 5 cm deep) on the brick wall. */
    screen: { position: [-1.6, 1.85, -4.95] as Vec3 },
    /** Its glass: 4 cm inside the bezel, just in front of it. Reading it is a seat you stand at. */
    careerScreen: {
        center: [-1.6, 1.85, -4.95 + 0.025 + 0.001] as Vec3,
        width: 2.28,
        height: 1.3,
    },
    sofa: { position: [2.4, 0, 3.15] as Vec3 },
    /** The "currently" letter board, on the right wall between the Hobbies door and the window. */
    currently: { position: [7, 1.65, 1.6] as Vec3 },
    /** The skill constellation's projector, in the open floor in front of the spawn point. */
    constellation: { position: [2.3, 0, -1.7] as Vec3 },
    coffeeTable: { position: [2.4, 0, 1.65] as Vec3 },
    /**
     * The desk monitor's glass (just in front of its bezel, see Lobby.tsx), facing
     * +z toward the chair. Sitting at the desk frames it and shows a page on it.
     */
    deskScreen: { center: [-4.3, 1.2, -4.05 - 0.2 + 0.016] as Vec3, width: 0.92, height: 0.52 },
    plants: [
        [6.45, 0, -4.35],
        [-6.2, 0, 4.25],
        [5.9, 0, 4.3],
    ] as Vec3[],
} as const;
