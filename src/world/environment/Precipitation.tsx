'use client';

import { useFrame } from '@react-three/fiber';
import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    NormalBlending,
    ShaderMaterial,
    Vector3,
} from 'three';
import { environment } from './time';

/**
 * Rain and snow, as GPU particles.
 *
 * Each drop/flake is one point. Instead of moving thousands of points in
 * JavaScript every frame, each point gets a fixed random "seed" once, and the
 * vertex shader computes its position from the seed and the current time:
 * fall = (start height - time * speed), wrapped with mod() so a drop that
 * hits the ground reappears at the top. The CPU only updates one number
 * (time) per frame; the GPU does the rest for all particles in parallel.
 *
 * The volume sits outside the south windows, so you watch the weather from
 * inside, and it never rains indoors.
 */

// Outside the south-facing windows of the lobby and Hobbies lounge.
const VOLUME_MIN = new Vector3(-14, -0.2, 5.6);
const VOLUME_SIZE = new Vector3(40, 14, 26);

type Kind = {
    count: number;
    speed: number; // metres per second
    size: number; // point size factor
    sway: number; // sideways drift in metres (snow wanders, rain doesn't)
    color: string;
    opacity: number;
    shape: 'streak' | 'flake';
    amount: () => number; // 0..1 from the weather
};

const KINDS: Record<'rain' | 'snow', Kind> = {
    rain: {
        count: 8000,
        speed: 13,
        size: 1.1,
        sway: 0,
        color: '#b8c6d6',
        opacity: 0.32,
        shape: 'streak',
        amount: () => environment.rain,
    },
    snow: {
        count: 6000,
        speed: 1.1,
        size: 0.32,
        sway: 0.5,
        color: '#ffffff',
        opacity: 0.9,
        shape: 'flake',
        amount: () => environment.snow,
    },
};

function makeGeometry(count: number) {
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const g = new BufferGeometry();
    // `position` is required by three.js; the shader ignores it and uses `seed`.
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('seed', new BufferAttribute(seeds, 3));
    return g;
}

function makeMaterial(k: Kind) {
    return new ShaderMaterial({
        transparent: true,
        depthWrite: false, // transparent particles shouldn't hide each other
        blending: k.shape === 'streak' ? AdditiveBlending : NormalBlending,
        uniforms: {
            uTime: { value: 0 },
            uAmount: { value: 0 },
            uSpeed: { value: k.speed },
            uSize: { value: k.size },
            uSway: { value: k.sway },
            uMin: { value: VOLUME_MIN },
            uExtent: { value: VOLUME_SIZE },
            uColor: { value: new Color(k.color) },
            uOpacity: { value: k.opacity },
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            uniform float uAmount;
            uniform float uSpeed;
            uniform float uSize;
            uniform float uSway;
            uniform vec3 uMin;
            uniform vec3 uExtent;
            attribute vec3 seed;
            varying float vVisible;

            void main() {
                vec3 p = uMin + seed * uExtent;
                // Fall, and wrap around to the top. Slight per-particle speed variation.
                float speed = uSpeed * (0.8 + 0.4 * seed.x);
                p.y = uMin.y + mod(seed.y * uExtent.y - uTime * speed, uExtent.y);
                // Gentle sideways wander (0 for rain).
                p.x += sin(uTime * 0.7 + seed.z * 6.283) * uSway;
                p.z += cos(uTime * 0.5 + seed.x * 6.283) * uSway;

                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                // Perspective: points shrink with distance, like real objects.
                gl_PointSize = uSize * 300.0 / -mv.z;
                // Light weather shows only some of the particles.
                vVisible = step(seed.z, uAmount);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uOpacity;
            varying float vVisible;

            void main() {
                if (vVisible < 0.5) discard;
                // gl_PointCoord: where we are inside this point's little square, 0..1.
                vec2 uv = gl_PointCoord - 0.5;
                float alpha = ${
                    k.shape === 'streak'
                        ? // a thin vertical line, fading at the ends
                          '(1.0 - smoothstep(0.0, 0.06, abs(uv.x))) * (1.0 - smoothstep(0.2, 0.5, abs(uv.y)))'
                        : // a soft round flake
                          '1.0 - smoothstep(0.25, 0.5, length(uv))'
                };
                if (alpha < 0.01) discard;
                gl_FragColor = vec4(uColor, alpha * uOpacity);
            }
        `,
    });
}

// Built once for the app (module scope), like the sky.
const systems = (Object.keys(KINDS) as (keyof typeof KINDS)[]).map((name) => {
    const kind = KINDS[name];
    return { name, kind, geometry: makeGeometry(kind.count), material: makeMaterial(kind) };
});
const clock = { time: 0 };

export function Precipitation() {
    useFrame((_, delta) => {
        clock.time += Math.min(delta, 0.1);
        for (const s of systems) {
            s.material.uniforms.uTime.value = clock.time;
            s.material.uniforms.uAmount.value = s.kind.amount();
        }
    });

    return (
        <>
            {systems.map((s) => (
                // frustumCulled off: the points' real positions come from the shader,
                // so three.js can't know their bounds and might wrongly skip drawing them.
                <points
                    key={s.name}
                    geometry={s.geometry}
                    material={s.material}
                    frustumCulled={false}
                />
            ))}
        </>
    );
}
