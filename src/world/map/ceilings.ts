import type { Mesh } from 'three';

/**
 * Every ceiling in the loft (Blocks with surface "ceiling" register here).
 * The map view hides them, dollhouse style, so you look straight into the
 * rooms.
 *
 * Hiding is just `visible = false`. A hidden mesh is skipped by every
 * render, including the sun's shadow map, so with the ceilings gone the
 * sun also falls into the rooms: brighter, which suits a view from above.
 */
export const ceilings = new Set<Mesh>();

export function showCeilings(show: boolean) {
    for (const mesh of ceilings) mesh.visible = show;
}
