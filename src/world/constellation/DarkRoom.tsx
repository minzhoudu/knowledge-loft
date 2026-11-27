'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, ShaderMaterial, type Group, type Mesh } from 'three';
import { blend, INSIDE } from './immersion';

/**
 * The dark room you stand in inside the constellation: a dim dome all
 * around, and a faint grid on the floor with a glowing ring at your feet,
 * so you keep a sense of up and down.
 *
 * Hiding the lobby doesn't mean switching it off. The dome is drawn after
 * everything solid, with depth testing off, so it paints over the whole
 * room regardless of what's in front, at whatever opacity the fade has
 * reached. Then the grid, and then the stars, which are drawn last
 * (renderOrder, see SkillConstellation) and so sit on top of the dark.
 * Fading the dome in and out is just one number, its opacity.
 */

/** Draw order among the transparent objects: room, then dome, grid, stars. */
export const ORDER = { dome: 10, grid: 11, stars: 12 };

const DOME_VERTEX = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const DOME_FRAGMENT = /* glsl */ `
    uniform float opacity;
    varying vec3 vDir;
    void main() {
        // Darkest overhead, a touch of blue-grey toward the horizon, like a
        // dim room whose walls you can't quite make out.
        vec3 horizon = vec3(0.016, 0.019, 0.03);
        vec3 overhead = vec3(0.002, 0.002, 0.004);
        vec3 color = mix(horizon, overhead, smoothstep(-0.1, 0.85, vDir.y));
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const GRID_VERTEX = /* glsl */ `
    varying vec2 vPos;
    void main() {
        vPos = position.xy; // metres from the centre, in the floor's plane
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const GRID_FRAGMENT = /* glsl */ `
    uniform float opacity;
    varying vec2 vPos;
    void main() {
        // Grid lines every half metre. fract() gives the position within a
        // cell; dividing the distance to the nearest line by fwidth (how much
        // the position changes across one screen pixel) gives a line exactly
        // one pixel wide at any distance, anti-aliased.
        vec2 cell = vPos / 0.5;
        vec2 d = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
        float line = 1.0 - min(min(d.x, d.y), 1.0);

        float r = length(vPos);
        float fade = 1.0 - smoothstep(1.2, 5.0, r); // the floor dissolves into the dark
        // The projector's ring at your feet, glowing.
        float ring = 1.0 - min(abs(r - 0.55) / (fwidth(r) * 1.5), 1.0);

        vec3 color = vec3(0.16, 0.22, 0.34) * line * fade + vec3(0.9, 1.15, 1.6) * ring;
        // Additive: adds light to the dark dome behind it, so opacity just scales it.
        gl_FragColor = vec4(color * opacity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export function DarkRoom() {
    const group = useRef<Group>(null);
    const dome = useRef<Mesh>(null);
    const grid = useRef<Mesh>(null);
    const materials = useMemo(
        () => ({
            dome: new ShaderMaterial({
                uniforms: { opacity: { value: 0 } },
                vertexShader: DOME_VERTEX,
                fragmentShader: DOME_FRAGMENT,
                side: BackSide, // we're inside it
                transparent: true,
                depthTest: false, // paints over the room, whatever is in front
                depthWrite: false,
            }),
            grid: new ShaderMaterial({
                uniforms: { opacity: { value: 0 } },
                vertexShader: GRID_VERTEX,
                fragmentShader: GRID_FRAGMENT,
                transparent: true,
                blending: AdditiveBlending,
                depthTest: false,
                depthWrite: false,
            }),
        }),
        [],
    );
    useEffect(
        () => () => {
            materials.dome.dispose();
            materials.grid.dispose();
        },
        [materials],
    );

    useFrame(() => {
        // The room goes dark early on the way in (and comes back late on the
        // way out), so you never see the cloud growing through the furniture.
        const dark = Math.min(1, blend.t * 1.8);
        if (group.current) group.current.visible = dark > 0.001;
        for (const m of [dome.current, grid.current]) {
            const material = m?.material as ShaderMaterial | undefined;
            if (material) material.uniforms.opacity.value = dark;
        }
    });

    const [x, y, z] = INSIDE.centre;
    return (
        <group ref={group} visible={false}>
            <mesh
                ref={dome}
                position={[x, y, z]}
                material={materials.dome}
                renderOrder={ORDER.dome}
                frustumCulled={false}
            >
                <sphereGeometry args={[6, 32, 16]} />
            </mesh>
            <mesh
                ref={grid}
                position={[x, 0.01, z]}
                rotation-x={-Math.PI / 2}
                material={materials.grid}
                renderOrder={ORDER.grid}
                frustumCulled={false}
            >
                <planeGeometry args={[12, 12]} />
            </mesh>
        </group>
    );
}
