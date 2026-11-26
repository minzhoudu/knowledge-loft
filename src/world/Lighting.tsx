'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';

// The sun aims at the middle of the built area (lobby + projects room).
const SUN_TARGET: [number, number, number] = [-6, 0, 0];
const SUN_OFFSET: [number, number, number] = [5.5, 6.5, 14]; // direction the light comes from
const SHADOW_HALF_SIZE = 15; // metres: covers both rooms

/**
 * Greybox lighting: just enough to read shapes.
 * - Hemisphere light: cheap ambient fill, sky colour from above, ground colour from below.
 * - Directional light: the sun, coming in through the lobby windows (+z) and casting shadows.
 *
 * A directional light's shadows are rendered by an orthographic camera that
 * looks from the light toward its target. Only things inside that camera's
 * box get shadows; anything outside is lit as if nothing blocked the sun.
 * That's why the box must cover every room: without it, the windowless
 * Projects room would be fully sunlit through its own ceiling. The bigger the
 * box, the more metres each shadow-map pixel covers, so it's no bigger than needed.
 */
export function Lighting() {
    const light = useRef<DirectionalLight>(null);
    const get = useThree((s) => s.get);

    useEffect(() => {
        const sun = light.current;
        if (!sun) return;
        // The target is an Object3D; it must be in the scene for its matrix to update.
        sun.target.position.set(...SUN_TARGET);
        const { scene } = get();
        scene.add(sun.target);
        return () => {
            scene.remove(sun.target);
        };
    }, [get]);

    const s = SHADOW_HALF_SIZE;
    return (
        <>
            <hemisphereLight args={['#e8eef5', '#8a8178', 2.0]} />
            <directionalLight
                ref={light}
                position={[
                    SUN_TARGET[0] + SUN_OFFSET[0],
                    SUN_TARGET[1] + SUN_OFFSET[1],
                    SUN_TARGET[2] + SUN_OFFSET[2],
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
                shadow-camera-near={1}
                shadow-camera-far={45}
            />
        </>
    );
}
