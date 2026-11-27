'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import { useWorld } from '@/store/world';
import { Interactable, useIsFocused } from '@/world/interaction/Interactable';
import type { RoomId } from '@/world/rooms/zones';
import { playClick } from './sound';
import { lightsTarget } from './state';

type Vec3 = [number, number, number];

const NAMES: Record<RoomId, string> = {
    lobby: 'Lobby',
    projects: 'Gallery',
    career: 'Corridor',
    hobbies: 'Lounge',
};

/**
 * A wall switch: a black steel plate with a brass toggle, the kind you'd
 * find in an old factory turned loft. Aim at it and press E.
 *
 * One switches the room's lamps, the other its blinds. The lever shows the
 * state (up = on, or blinds down), easing over like a real toggle snapping.
 * On automatic, a light switch's lever follows the lamps as dusk falls.
 *
 * `position` is on the wall's surface; `rotationY` turns the plate's front
 * (local +z) to face into the room.
 */
export function SwitchPlate({
    room,
    what,
    position,
    rotationY,
}: {
    room: RoomId;
    what: 'lights' | 'blinds';
    position: Vec3;
    rotationY: number;
}) {
    const label = `${what === 'lights' ? 'Lights' : 'Blinds'} · ${NAMES[room]}`;
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id={`switch:${room}:${what}`}
                label={label}
                action={{ kind: 'switch', room, what }}
            >
                <Plate room={room} what={what} position={position} />
            </Interactable>
        </group>
    );
}

function Plate({
    room,
    what,
    position,
}: {
    room: RoomId;
    what: 'lights' | 'blinds';
    position: Vec3;
}) {
    const focused = useIsFocused();
    const lever = useRef<Group>(null);

    // Click when this switch is flipped (from E, or anywhere else).
    useEffect(
        () =>
            useWorld.subscribe((s, prev) => {
                const now = what === 'lights' ? s.lights[room] : s.blinds[room];
                const before = what === 'lights' ? prev.lights[room] : prev.blinds[room];
                if (now !== before) playClick(position);
            }),
        [room, what, position],
    );

    useFrame((_, delta) => {
        const l = lever.current;
        if (!l) return;
        const up =
            what === 'lights' ? lightsTarget(room) > 0.5 : !!useWorld.getState().blinds[room];
        const target = up ? -0.45 : 0.45; // tipped up or down
        l.rotation.x += (target - l.rotation.x) * (1 - Math.exp(-25 * Math.min(delta, 0.1)));
    });

    return (
        <>
            {/* the plate */}
            <mesh position-z={0.004} castShadow receiveShadow>
                <boxGeometry args={[0.085, 0.13, 0.008]} />
                <meshStandardMaterial
                    color="#1d1e21"
                    roughness={0.45}
                    metalness={0.7}
                    emissive="#e0a56a"
                    emissiveIntensity={focused ? 0.25 : 0}
                />
            </mesh>
            {/* the boss the lever pivots in */}
            <mesh position-z={0.011} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.014, 0.016, 0.008, 20]} />
                <meshStandardMaterial color="#b08a4a" roughness={0.3} metalness={0.9} />
            </mesh>
            {/* the lever: a brass bat, tipping up or down about the boss */}
            <group ref={lever} position-z={0.014}>
                <mesh position-z={0.017} rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.0045, 0.006, 0.034, 12]} />
                    <meshStandardMaterial color="#c9a25a" roughness={0.25} metalness={0.95} />
                </mesh>
            </group>
            {/* two screws */}
            {[0.05, -0.05].map((y) => (
                <mesh key={y} position={[0, y, 0.009]} rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.004, 0.004, 0.002, 10]} />
                    <meshStandardMaterial color="#8d9096" roughness={0.4} metalness={0.9} />
                </mesh>
            ))}
            {/* a bigger invisible target, so a small switch is easy to aim at */}
            <mesh position-z={0.03} visible={false}>
                <boxGeometry args={[0.2, 0.26, 0.06]} />
            </mesh>
        </>
    );
}
