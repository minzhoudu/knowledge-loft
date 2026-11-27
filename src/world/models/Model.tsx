'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Box3, Color, Mesh, Vector3, type Group, type MeshStandardMaterial } from 'three';
import { useIsFocused } from '@/world/interaction/Interactable';
import type { RoomId } from '@/world/rooms/zones';
import { lightsTarget } from '@/world/switches/state';

/** Files in public/models, built by `pnpm models` (scripts/build-models.mjs). */
export type ModelName =
    | 'armchair'
    | 'barber-chair'
    | 'books'
    | 'clock'
    | 'coffee-table'
    | 'compass'
    | 'cube-shelves'
    | 'desk'
    | 'desk-lamp'
    | 'floor-lamp'
    | 'gaming-pc'
    | 'industrial-pendant'
    | 'laptop'
    | 'led-bulb'
    | 'lounge-chair'
    | 'monstera'
    | 'ottoman'
    | 'padlock'
    | 'pendant'
    | 'perfume'
    | 'pillows'
    | 'plant-pot'
    | 'plant-tall'
    | 'ray'
    | 'round-table'
    | 'scuba-mask'
    | 'security-camera'
    | 'shark'
    | 'shell'
    | 'sofa'
    | 'solar-panel'
    | 'spray-bottle'
    | 'steel-shelves'
    | 'stool'
    | 'street-lamp'
    | 'suitcase'
    | 'terrarium'
    | 'turntable'
    | 'tyre'
    | 'tyre-pump'
    | 'vase'
    | 'wall-lamp';

type Vec3 = [number, number, number];

type Props = {
    name: ModelName;
    /** Where the model's bottom centre sits (the build script puts the origin there). */
    position?: Vec3;
    rotationY?: number;
    scale?: number;
    /**
     * Give it a box collider (its bounding box) so you can't walk through it.
     * Off for small props sitting on other things.
     */
    collider?: boolean;
    /**
     * Cast sun shadows. Defaults to `collider`: furniture casts, small props
     * don't (their shadows are a few texels in the shadow map anyway, and
     * every caster is drawn a second time in the shadow pass).
     */
    castShadow?: boolean;
    /**
     * A light fitting: its glass (any material named like "glass") glows
     * whenever this room's lights are on, following the room's switch.
     */
    glowsWith?: RoomId;
};

/** The warm glow of a lit bulb behind glass. */
const BULB = new Color('#ffd39a');
const isGlass = (m: { name: string }) => /glass/i.test(m.name);

/**
 * A model from public/models, placed in the world.
 *
 * It loads on its own: each model is wrapped in its own Suspense, so the
 * room appears right away and furniture pops in as its file arrives, instead
 * of the whole scene waiting for the slowest download.
 *
 * Inside an <Interactable>, it glows softly while looked at, like a Block.
 */
export function Model(props: Props) {
    return (
        <Suspense fallback={null}>
            <LoadedModel {...props} />
        </Suspense>
    );
}

function LoadedModel({
    name,
    position = [0, 0, 0],
    rotationY = 0,
    scale = 1,
    collider = true,
    castShadow = collider,
    glowsWith,
}: Props) {
    // Draco off (our files don't use it, so drei won't fetch its decoder),
    // meshopt on (the build script compresses with it).
    const { scene } = useGLTF(`/models/${name}.glb`, false, true);
    const focused = useIsFocused();
    const group = useRef<Group>(null);

    // useGLTF caches by URL, so every <Model name="sofa"> gets the same scene,
    // and a three.js object can only be in one place. So each instance renders
    // its own clone. Geometry and textures stay shared (the expensive parts);
    // materials are cloned, so one copy can glow without lighting up the others.
    const { object, half, centre } = useMemo(() => {
        const object = scene.clone(true);
        object.traverse((o) => {
            if (!(o instanceof Mesh)) return;
            o.castShadow = castShadow;
            o.receiveShadow = true;
            const m = (o.material as MeshStandardMaterial).clone();
            // Glow = the material's own colour and texture, added on top.
            m.emissive.copy(m.color);
            m.emissiveMap = m.map;
            m.emissiveIntensity = 0;
            o.material = m;
        });
        const box = new Box3().setFromObject(object);
        const size = box.getSize(new Vector3()).multiplyScalar(scale / 2);
        const mid = box.getCenter(new Vector3()).multiplyScalar(scale);
        return {
            object,
            half: [size.x, size.y, size.z] as Vec3,
            centre: [mid.x, mid.y, mid.z] as Vec3,
        };
    }, [scene, scale, castShadow]);

    useEffect(
        () => () =>
            object.traverse((o) => {
                if (o instanceof Mesh) (o.material as MeshStandardMaterial).dispose();
            }),
        [object],
    );

    useEffect(() => {
        group.current?.traverse((o) => {
            if (!(o instanceof Mesh)) return;
            const m = o.material as MeshStandardMaterial;
            if (glowsWith && isGlass(m)) {
                m.emissive.copy(BULB);
                m.emissiveMap = null; // glow evenly, not in the texture's pattern
            } else {
                m.emissiveIntensity = focused ? 0.3 : 0;
            }
        });
    }, [focused, glowsWith]);

    // A light fitting's glass glows with the room's lights, eased like its lamps (see Lamp).
    const lit = useRef(-1);
    useFrame((_, delta) => {
        if (!glowsWith || !group.current) return;
        const target = lightsTarget(glowsWith);
        lit.current =
            lit.current < 0
                ? target
                : lit.current + (target - lit.current) * (1 - Math.exp(-12 * Math.min(delta, 0.1)));
        // Above 1 so the bloom pass picks it up: a lit bulb glares a little.
        const glow = 2.4 * lit.current;
        group.current.traverse((o) => {
            if (o instanceof Mesh && isGlass(o.material)) o.material.emissiveIntensity = glow;
        });
    });

    const visual = (
        <group ref={group} scale={scale}>
            <primitive object={object} />
        </group>
    );

    // The transform lives on a plain group, not on the RigidBody's own
    // position/rotation props: a fixed body copies those into physics but
    // never back onto its object, so a rotated model would render unrotated.
    // A body created inside a transformed group takes the group's world
    // transform instead, which keeps the visual and the collider together.
    return (
        <group position={position} rotation-y={rotationY}>
            {collider ? (
                <RigidBody type="fixed" colliders={false}>
                    <CuboidCollider args={half} position={centre} />
                    {visual}
                </RigidBody>
            ) : (
                visual
            )}
        </group>
    );
}
