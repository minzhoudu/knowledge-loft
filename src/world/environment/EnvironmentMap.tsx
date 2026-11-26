'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
    CubeCamera,
    HalfFloatType,
    Mesh,
    PMREMGenerator,
    Scene,
    SphereGeometry,
    WebGLCubeRenderTarget,
    type ShaderMaterial,
    type WebGLRenderTarget,
} from 'three';

const REFRESH_SECONDS = 0.5; // the sky changes slowly; twice a second is plenty
/** How strongly the sky lights and reflects in materials. Indoors, below 1. */
export const ENV_INTENSITY = 0.55;

/**
 * Image-based lighting from our own sky.
 *
 * Real materials don't only reflect the sun: they reflect everything around
 * them, and that's most of what makes them look real (the soft sheen on a
 * floor, the sky in a steel frame). three.js does this with an environment
 * map: a 360° picture of the surroundings that every material samples.
 *
 * Usually that's a photo (an HDRI). Ours must change with the time, season
 * and weather, so we photograph our own sky dome instead:
 * 1. A CubeCamera renders the sky into the 6 faces of a cube (64 px each is
 *    enough: it's mostly gradients), in half-float so the sun stays brighter
 *    than white.
 * 2. PMREMGenerator pre-blurs it into a ladder of sharp-to-blurry versions
 *    ("prefiltered mipmaps"), so a glossy floor reads a sharp reflection and
 *    a matte wall reads a soft average, each with a single lookup.
 * 3. That becomes scene.environment, used by every standard material.
 *
 * It refreshes twice a second, which costs a few small renders.
 */
const state: { refresh: (() => void) | null; elapsed: number } = { refresh: null, elapsed: 0 };

export function EnvironmentMap({ material }: { material: ShaderMaterial }) {
    const get = useThree((s) => s.get);

    useEffect(() => {
        const { gl, scene } = get();
        const cubeTarget = new WebGLCubeRenderTarget(64, { type: HalfFloatType });
        const cubeCamera = new CubeCamera(0.1, 100, cubeTarget);
        const skyScene = new Scene();
        const dome = new Mesh(new SphereGeometry(50, 32, 16), material);
        skyScene.add(dome);
        const pmrem = new PMREMGenerator(gl);
        let envTarget: WebGLRenderTarget | null = null;

        state.refresh = () => {
            cubeCamera.update(gl, skyScene);
            // Reuse the same output target after the first time (no reallocation).
            // (The output is a 2D atlas target; @types/three mislabels the parameter as a cube target.)
            envTarget = pmrem.fromCubemap(
                cubeTarget.texture,
                envTarget as unknown as WebGLCubeRenderTarget | null,
            );
            scene.environment = envTarget.texture;
        };
        scene.environmentIntensity = ENV_INTENSITY;
        state.refresh();

        return () => {
            state.refresh = null;
            scene.environment = null;
            envTarget?.dispose();
            cubeTarget.dispose();
            dome.geometry.dispose();
            pmrem.dispose();
        };
    }, [get, material]);

    useFrame((_, delta) => {
        state.elapsed += delta;
        if (state.elapsed < REFRESH_SECONDS) return;
        state.elapsed = 0;
        state.refresh?.();
    });

    return null;
}
