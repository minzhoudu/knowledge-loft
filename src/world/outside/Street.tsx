'use client';

import { useEffect, useRef } from 'react';
import { Object3D, type InstancedMesh } from 'three';
import { Block } from '@/world/greybox/Block';
import { Lamp } from '@/world/environment/Lamp';
import { Model } from '@/world/models/Model';
import { STREET } from './layout';

/**
 * The street in front of the windows: pavement, kerbs, a two-lane road
 * with a dashed centre line, and street lamps that glow at night.
 */

const L = STREET.halfLength * 2;
const [nearFrom, nearTo] = STREET.nearPavement;
const [roadFrom, roadTo] = STREET.road;
const [farFrom, farTo] = STREET.farPavement;
const SLAB = 0.3; // how deep the slabs go below their top

/** Lamp posts: x positions along each pavement. */
const NEAR_LAMPS = [-21, -7.5, 7.5, 21];
const FAR_LAMPS = [-14, 0, 14];
/** Height of the lantern's glass on the lamp model (measured: 3.87 m tall overall). */
const LANTERN_Y = 3.35;

export function Street() {
    const slab = (
        from: number,
        to: number,
        top: number,
        surface: 'pavers' | 'asphalt' | 'kerb',
    ) => (
        <Block
            size={[L, SLAB, to - from]}
            position={[0, top - SLAB / 2, (from + to) / 2]}
            surface={surface}
        />
    );
    const nearLampZ = nearTo - 0.5;
    const farLampZ = farFrom + 0.5;

    return (
        <group>
            {slab(nearFrom, nearTo, STREET.pavementTop, 'pavers')}
            {slab(nearTo, roadFrom, STREET.pavementTop, 'kerb')}
            {slab(roadFrom, roadTo, STREET.roadTop, 'asphalt')}
            {slab(roadTo, farFrom, STREET.pavementTop, 'kerb')}
            {slab(farFrom, farTo, STREET.pavementTop, 'pavers')}
            <CentreLine />

            {NEAR_LAMPS.map((x) => (
                <group key={`n${x}`}>
                    <Model
                        name="street-lamp"
                        position={[x, STREET.pavementTop, nearLampZ]}
                        collider={false}
                    />
                    <Lamp
                        position={[x, LANTERN_Y, nearLampZ]}
                        intensity={0}
                        bulbRadius={0.09}
                        light={false}
                    />
                </group>
            ))}
            {FAR_LAMPS.map((x) => (
                <group key={`f${x}`}>
                    <Model
                        name="street-lamp"
                        position={[x, STREET.pavementTop, farLampZ]}
                        rotationY={Math.PI}
                        collider={false}
                    />
                    <Lamp
                        position={[x, LANTERN_Y, farLampZ]}
                        intensity={0}
                        bulbRadius={0.09}
                        light={false}
                    />
                </group>
            ))}
        </group>
    );
}

const DASH = 3; // metres of paint
const GAP = 6;
const DASHES = Math.floor(L / (DASH + GAP));

/** The dashed centre line: every dash is one instance of one mesh, so one draw call. */
function CentreLine() {
    const mesh = useRef<InstancedMesh>(null);
    useEffect(() => {
        const m = mesh.current;
        if (!m) return;
        const o = new Object3D();
        const z = (STREET.road[0] + STREET.road[1]) / 2;
        for (let i = 0; i < DASHES; i++) {
            o.position.set(
                -STREET.halfLength + (i + 0.5) * (DASH + GAP),
                STREET.roadTop + 0.004,
                z,
            );
            o.updateMatrix();
            m.setMatrixAt(i, o.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
    }, []);
    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, DASHES]} receiveShadow>
            <boxGeometry args={[DASH, 0.006, 0.14]} />
            <meshStandardMaterial color="#e9e6dc" roughness={0.7} />
        </instancedMesh>
    );
}
