'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshStandardMaterial, PointLight } from 'three';
import type { RoomId } from '@/world/rooms/zones';
import { dusk, lightsTarget } from '@/world/switches/state';

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
    /**
     * The room it's in: it then follows that room's light switch (and, until
     * the switch is used, the room's automatic rule). Without one it simply
     * comes on at dusk, like a street lamp.
     */
    room?: RoomId;
};

/**
 * A lamp: a point light plus a glowing bulb, on at dusk or by its room's
 * switch (see world/switches).
 *
 * It fades in through dusk instead of snapping on, following daylight from
 * the shared `environment` object, read in the render loop (no re-renders).
 * A switch fades it too, just faster: a quarter of a second.
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
    room,
}: Props) {
    const light = useRef<PointLight>(null);
    const bulb = useRef<MeshStandardMaterial>(null);
    const on = useRef(-1); // how on it is right now, 0..1 (-1: not set yet)

    useFrame((_, delta) => {
        const target = room ? lightsTarget(room) : dusk();
        // The first frame starts settled; after that, ease (fast enough to
        // feel like a switch, slow enough not to strobe).
        on.current =
            on.current < 0
                ? target
                : on.current + (target - on.current) * (1 - Math.exp(-12 * Math.min(delta, 0.1)));
        if (light.current) light.current.intensity = intensity * on.current;
        if (bulb.current) bulb.current.emissiveIntensity = 0.15 + 2.5 * on.current;
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
