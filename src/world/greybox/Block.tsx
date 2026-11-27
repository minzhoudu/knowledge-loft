'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { useIsFocused } from '@/world/interaction/Interactable';
import { ceilings } from '@/world/map/ceilings';
import { plainProps, surfaceProps, worldBox, type Surface } from '@/world/materials/surfaces';

type Vec3 = [number, number, number];

type Props = {
    size: Vec3;
    position: Vec3;
    /** What it's made of (see materials/surfaces.ts). */
    surface?: Surface;
    /** A one-off plain colour instead of a surface (fabric, ceramics). */
    color?: string;
    rotationY?: number;
};

/**
 * A building block: a box made of one material.
 * Inside an <Interactable>, it glows softly while the player looks at it.
 *
 * Each block gets its own material instance (the textures behind it are
 * shared), so one block can glow without lighting up every other block of
 * the same surface. three.js compiles one shader per material *type and
 * features*, not per instance, so this costs almost nothing.
 */
export function Block({ size, position, surface = 'wood', color, rotationY = 0 }: Props) {
    const focused = useIsFocused();
    const [w, h, d] = size;
    const [x, y, z] = position;
    const geometry = useMemo(
        () => worldBox([w, h, d], [x, y, z], rotationY),
        [w, h, d, x, y, z, rotationY],
    );
    useEffect(() => () => geometry.dispose(), [geometry]);
    // Ceilings register so the map view can hide them (see map/ceilings.ts).
    const mesh = useRef<Mesh>(null);
    useEffect(() => {
        const m = mesh.current;
        if (surface !== 'ceiling' || !m) return;
        ceilings.add(m);
        return () => {
            ceilings.delete(m);
        };
    }, [surface]);
    const look = color ? plainProps(color) : surfaceProps(surface);

    return (
        <mesh
            ref={mesh}
            geometry={geometry}
            position={position}
            rotation-y={rotationY}
            castShadow
            receiveShadow
        >
            <meshStandardMaterial
                {...look}
                emissive={look.color}
                emissiveIntensity={focused ? 0.35 : 0}
            />
        </mesh>
    );
}
