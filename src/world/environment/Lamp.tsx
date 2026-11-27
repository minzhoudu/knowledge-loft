'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshStandardMaterial, PointLight } from 'three';
import { smoothstep } from './sun';
import { environment } from './time';

type Props = {
    position: [number, number, number];
    /** Brightness when fully on, in candela (three.js physical light units). */
    intensity: number;
    color?: string;
    /** Size of the visible bulb; 0 hides it (light only). */
    bulbRadius?: number;
    /**
     * Whether it lights its surroundings. Off = just a glowing bulb, for lamps
     * seen from afar (the street). Every real light costs every lit surface a
     * little work each frame, whether it's bright or not, so they're kept for
     * lamps whose light you'd actually see land on things.
     */
    light?: boolean;
};

/**
 * A lamp that switches on as it gets dark: a point light plus a glowing bulb.
 *
 * It fades in through dusk instead of snapping on, following daylight from
 * the shared `environment` object, read in the render loop (no re-renders).
 *
 * Note it never sets `visible = false` on the light: three.js compiles its
 * shaders for a specific number of lights, so adding or removing lights at
 * runtime forces every material to recompile, a visible hitch. Dimming to 0
 * keeps the light count constant, so nothing recompiles.
 */
export function Lamp({
    position,
    intensity,
    color = '#ffd39a',
    bulbRadius = 0.12,
    light: lit = true,
}: Props) {
    const light = useRef<PointLight>(null);
    const bulb = useRef<MeshStandardMaterial>(null);

    useFrame(() => {
        // On once daylight drops below ~40%, fully on at ~10%.
        const on = 1 - smoothstep(0.1, 0.4, environment.daylight);
        if (light.current) light.current.intensity = intensity * on;
        if (bulb.current) bulb.current.emissiveIntensity = 0.15 + 2.5 * on;
    });

    return (
        <group position={position}>
            {lit && <pointLight ref={light} color={color} intensity={0} decay={2} />}
            {bulbRadius > 0 && (
                <mesh>
                    <sphereGeometry args={[bulbRadius, 16, 12]} />
                    <meshStandardMaterial ref={bulb} color="#fff6e8" emissive={color} />
                </mesh>
            )}
        </group>
    );
}
