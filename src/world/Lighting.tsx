'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { WORLD_BOUNDS as B } from '@/world/rooms/bounds';

// Aim the sun at the middle of everything that's built.
const CENTER: [number, number, number] = [(B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2];
// Half the floor plan's diagonal: a box this size covers the whole plan from
// any light direction, since no point is farther than that from the centre.
const HALF_SIZE = Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ) / 2 + 1;
const SUN_OFFSET: [number, number, number] = [5.5, 6.5, 14]; // the direction sunlight comes from
const SUN_DISTANCE = Math.hypot(...SUN_OFFSET);

/**
 * Greybox lighting: just enough to read shapes.
 * - Hemisphere light: cheap ambient fill, sky colour from above, ground colour from below.
 * - Directional light: the sun, coming in through the lobby windows (+z) and casting shadows.
 *
 * A directional light's shadows are rendered by an orthographic camera that
 * looks from the light toward its target. Only things inside that camera's
 * box get shadows; anything outside is lit as if nothing blocked the sun.
 * The box must cover every room, or windowless rooms would be sunlit through
 * their ceilings. A bigger box spreads the same shadow-map pixels over more
 * metres, so it's computed from the rooms' bounds rather than guessed.
 */
export function Lighting() {
    const light = useRef<DirectionalLight>(null);
    const get = useThree((s) => s.get);

    useEffect(() => {
        const sun = light.current;
        if (!sun) return;
        // The target is an Object3D; it must be in the scene for its matrix to update.
        sun.target.position.set(...CENTER);
        const { scene } = get();
        scene.add(sun.target);
        return () => {
            scene.remove(sun.target);
        };
    }, [get]);

    const s = HALF_SIZE;
    return (
        <>
            <hemisphereLight args={['#e8eef5', '#8a8178', 2.0]} />
            <directionalLight
                ref={light}
                position={[
                    CENTER[0] + SUN_OFFSET[0],
                    CENTER[1] + SUN_OFFSET[1],
                    CENTER[2] + SUN_OFFSET[2],
                ]}
                intensity={2.4}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0003}
                shadow-normalBias={0.03}
                shadow-camera-left={-s}
                shadow-camera-right={s}
                shadow-camera-top={s}
                shadow-camera-bottom={-s}
                shadow-camera-near={0.5}
                shadow-camera-far={SUN_DISTANCE + s + 5}
            />
        </>
    );
}
