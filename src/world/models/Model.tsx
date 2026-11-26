'use client';

import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Box3, Mesh, Vector3, type Group, type MeshStandardMaterial } from 'three';
import { useIsFocused } from '@/world/interaction/Interactable';

/** Files in public/models, built by `pnpm models` (scripts/build-models.mjs). */
export type ModelName =
    | 'armchair'
    | 'books'
    | 'clock'
    | 'coffee-table'
    | 'cube-shelves'
    | 'desk'
    | 'desk-lamp'
    | 'floor-lamp'
    | 'gaming-pc'
    | 'industrial-pendant'
    | 'laptop'
    | 'lounge-chair'
    | 'monstera'
    | 'ottoman'
    | 'pendant'
    | 'pillows'
    | 'plant-pot'
    | 'plant-tall'
    | 'ray'
    | 'round-table'
    | 'scuba-mask'
    | 'shark'
    | 'shell'
    | 'sofa'
    | 'steel-shelves'
    | 'stool'
    | 'turntable'
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
};

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
            if (o instanceof Mesh) {
                (o.material as MeshStandardMaterial).emissiveIntensity = focused ? 0.3 : 0;
            }
        });
    }, [focused]);

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
