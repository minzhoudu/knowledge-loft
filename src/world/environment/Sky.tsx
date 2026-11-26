'use client';

import { BackSide, Color, ShaderMaterial, Vector3 } from 'three';

/**
 * A sky dome: a huge sphere around the world, drawn from the inside
 * (BackSide), with a custom shader that paints the sky per pixel.
 *
 * A shader is a small program that runs on the GPU. The vertex shader runs
 * once per corner of the sphere and passes its world position along; the
 * fragment shader runs once per pixel and decides its colour from the view
 * direction: a gradient from horizon to zenith, a sun disc with a soft
 * glow around it, and stars at night.
 */

export type SkyUniforms = {
    uTop: { value: Color };
    uHorizon: { value: Color };
    uGround: { value: Color };
    uSunDir: { value: Vector3 };
    uSunColor: { value: Color };
    uSunStrength: { value: number };
    uStars: { value: number };
    /** 0 = clear, 1 = fully overcast. */
    uCloud: { value: number };
    /** The flat grey of an overcast sky (brighter by day, near-black at night). */
    uOvercast: { value: Color };
};

export function createSkyMaterial() {
    const uniforms: SkyUniforms = {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uGround: { value: new Color() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color() },
        uSunStrength: { value: 1 },
        uStars: { value: 0 },
        uCloud: { value: 0 },
        uOvercast: { value: new Color() },
    };
    return new ShaderMaterial({
        uniforms,
        side: BackSide,
        depthWrite: false, // the sky is always "behind" everything
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uTop;
            uniform vec3 uHorizon;
            uniform vec3 uGround;
            uniform vec3 uSunDir;
            uniform vec3 uSunColor;
            uniform float uSunStrength;
            uniform float uStars;
            uniform float uCloud;
            uniform vec3 uOvercast;
            varying vec3 vWorld;

            // Cheap pseudo-random number from a 3D cell: same input, same output.
            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            void main() {
                // cameraPosition is provided by three.js to every ShaderMaterial.
                vec3 dir = normalize(vWorld - cameraPosition);
                float h = dir.y;

                // Horizon -> zenith above, horizon -> ground below.
                vec3 col = h > 0.0
                    ? mix(uHorizon, uTop, pow(h, 0.5))
                    : mix(uHorizon, uGround, pow(-h, 0.4));

                // Clouds: blend toward a flat overcast grey (a touch darker below the horizon).
                vec3 overcast = uOvercast * (h > 0.0 ? 1.0 : 0.8);
                col = mix(col, overcast, uCloud * 0.92);
                float clear = 1.0 - uCloud;

                // Sun: a tiny bright disc plus a wide soft halo; clouds hide both.
                float s = max(dot(dir, uSunDir), 0.0);
                col += uSunColor * (pow(s, 1500.0) * 10.0 + pow(s, 10.0) * 0.3) * uSunStrength * clear;

                // Stars: split the sky into tiny cells and light up a rare few.
                if (uStars > 0.0 && h > 0.0) {
                    float star = step(0.9978, hash(floor(dir * 260.0)));
                    col += vec3(star) * uStars * clear * smoothstep(0.0, 0.25, h);
                }

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    });
}

/** The dome mesh. Radius must stay inside the camera's far plane (200). */
export function Sky({ material }: { material: ShaderMaterial }) {
    return (
        <mesh renderOrder={-1} frustumCulled={false}>
            <sphereGeometry args={[150, 32, 16]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
