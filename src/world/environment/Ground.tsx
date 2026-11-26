'use client';

import { MeshStandardMaterial } from 'three';

/**
 * The land around the studio, seen through the windows. One big plane just
 * below the floor; its colour is set every frame by the lighting system
 * (season, wet after rain, white as snow settles).
 *
 * The material lives at module scope so the render loop can change it
 * without going through React (see Lighting.tsx).
 */
export const groundMaterial = new MeshStandardMaterial({ color: '#7f9a5a', roughness: 1 });

export function Ground() {
    return (
        // Kept within the sky dome (radius 150) so its edge never shows; fog
        // hides the far part anyway. No shadows: the sun's shadow box only
        // covers the building, and a shadow edge out on the grass would show.
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.22, 0]} material={groundMaterial}>
            <circleGeometry args={[145, 48]} />
        </mesh>
    );
}
