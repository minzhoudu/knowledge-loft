'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, MeshStandardMaterial, type Mesh } from 'three';
import { useWorld } from '@/store/world';
import { environment } from '@/world/environment/time';
import type { RoomId } from '@/world/rooms/zones';
import { playMotor } from './sound';
import { blindDrop } from './state';

/** How long a blind takes to travel all the way, in seconds (a motor's pace). */
const TRAVEL = 3.5;
const GAP = 0.05; // between neighbouring blinds

/**
 * Motorised roller blinds across a window, inside the room.
 *
 * Each blind is a roller in a slim housing plus a fabric sheet that unrolls
 * downward: a 1×1 plane, scaled to the length that's out and moved so its
 * top stays at the roller. Lowering them does three things:
 * - the fabric casts a shadow, so the sun's patch on the floor goes away
 *   (the sun's shadow map does that for free; light slips through the gaps
 *   between blinds, like the real thing);
 * - the room's ambient daylight dims with how far they're down (Lighting
 *   reads blindDrop for the room you're in);
 * - the fabric glows faintly with the daylight behind it, as linen does.
 */
export function Blinds({
    room,
    x0,
    x1,
    top,
    bottom,
    z,
    count,
}: {
    room: RoomId;
    /** The window's span along x. */
    x0: number;
    x1: number;
    /** Where the roller sits, and how far down the fabric goes. */
    top: number;
    bottom: number;
    /** Just inside the window wall's inner face. */
    z: number;
    /** How many blinds share the window. */
    count: number;
}) {
    const sheets = useRef<(Mesh | null)[]>([]);
    const rails = useRef<(Mesh | null)[]>([]);
    const fabric = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#d9cdb9',
                roughness: 0.95,
                side: DoubleSide,
                emissive: '#fff0d4',
                emissiveIntensity: 0,
            }),
        [],
    );
    useEffect(() => () => fabric.dispose(), [fabric]);

    const width = (x1 - x0 - GAP * (count - 1)) / count;
    const length = top - bottom;
    const centres = Array.from({ length: count }, (_, i) => x0 + width / 2 + i * (width + GAP));

    // The motor hums whenever the blinds are sent up or down.
    useEffect(
        () =>
            useWorld.subscribe((s, prev) => {
                if (!!s.blinds[room] === !!prev.blinds[room]) return;
                const remaining = s.blinds[room] ? 1 - blindDrop[room] : blindDrop[room];
                playMotor([(x0 + x1) / 2, top, z], remaining * TRAVEL);
            }),
        [room, x0, x1, top, z],
    );

    useFrame((_, delta) => {
        const target = useWorld.getState().blinds[room] ? 1 : 0;
        const step = Math.min(delta, 0.1) / TRAVEL; // constant speed, like a motor
        const d = blindDrop[room];
        const next = target > d ? Math.min(target, d + step) : Math.max(target, d - step);
        blindDrop[room] = next;

        const out = next * length;
        for (const sheet of sheets.current) {
            if (!sheet) continue;
            sheet.visible = next > 0.002;
            sheet.scale.y = Math.max(out, 0.001);
            sheet.position.y = top - out / 2;
            // Backlit linen: brighter the brighter it is outside.
            (sheet.material as MeshStandardMaterial).emissiveIntensity =
                0.32 * environment.daylight;
        }
        for (const rail of rails.current) if (rail) rail.position.y = top - out - 0.012;
    });

    return (
        <group>
            {centres.map((cx, i) => (
                <group key={cx} position={[cx, 0, z]}>
                    {/* the roller's housing */}
                    <mesh position={[0, top + 0.04, -0.02]} castShadow>
                        <boxGeometry args={[width + 0.02, 0.09, 0.09]} />
                        <meshStandardMaterial color="#1d1e21" roughness={0.5} metalness={0.6} />
                    </mesh>
                    <mesh
                        ref={(m) => {
                            sheets.current[i] = m;
                        }}
                        material={fabric}
                        rotation-y={Math.PI}
                        visible={false}
                        castShadow
                        receiveShadow
                    >
                        <planeGeometry args={[width, 1]} />
                    </mesh>
                    {/* the weighted bar along the bottom edge */}
                    <mesh
                        ref={(m) => {
                            rails.current[i] = m;
                        }}
                        position={[0, top - 0.012, -0.004]}
                        castShadow
                    >
                        <boxGeometry args={[width, 0.024, 0.018]} />
                        <meshStandardMaterial color="#2a2b2e" roughness={0.4} metalness={0.7} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}
