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
} as const;

type Vec3 = [number, number, number];

export const MARKERS = {
    spawn: { position: [4.8, 1, 0.4] as Vec3, yaw: 0.93 },
    plinth: { position: [-1.4, 0, 0.6] as Vec3 },
    desk: { position: [-4.3, 0, -4.05] as Vec3 },
    shelf: { position: [1.6, 0, -4.79] as Vec3 },
    screen: { position: [-1.6, 1.85, -4.95] as Vec3 },
    sofa: { position: [2.4, 0, 3.15] as Vec3 },
    coffeeTable: { position: [2.4, 0, 1.65] as Vec3 },
    plants: [
        [6.45, 0, -4.35],
        [-6.2, 0, 4.25],
        [5.9, 0, 4.3],
    ] as Vec3[],
} as const;
