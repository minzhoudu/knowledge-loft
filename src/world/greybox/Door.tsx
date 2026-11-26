'use client';

import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import { Euler, Quaternion } from 'three';
import { useWorld } from '@/store/world';
import { Interactable } from '@/world/interaction/Interactable';
import { Block } from './Block';

const OPEN_ANGLE = (100 * Math.PI) / 180; // a bit past 90°, like a real door swung wide
const SWING_RATE = 5; // higher = snappier; see the smoothing note below
const LEAF_THICKNESS = 0.05;
const GAP = 0.02; // clearance between leaf and frame so it never scrapes

type Props = {
    /** Unique door id; its open/closed state lives in the store under this key. */
    id: string;
    label: string;
    /** Hinge position on the floor plan (x, z), at the edge of the opening. */
    hinge: [number, number];
    /**
     * Orientation: rotates the door's local +x (hinge → latch) onto the opening.
     * Local -z is the side a positive swing opens toward.
     */
    rotationY: number;
    /** +1 swings toward local -z, -1 toward local +z. Pick the side of the new room. */
    swing: 1 | -1;
    width: number;
    height: number;
};

/**
 * A hinged door that animates open and closed.
 *
 * The leaf is a *kinematic* rigid body: physics doesn't push it around, we
 * drive it ourselves, but it still pushes dynamic bodies (the player) out of
 * its way. Each frame we tell Rapier where it should be on the next physics
 * step with setNextKinematicRotation, and Rapier works out the velocity
 * needed to get there, which is what makes collisions with a moving door
 * behave (teleporting it instead would let it pass through you).
 *
 * The body's origin is the hinge, so rotating the body swings the door
 * around the hinge, the same trick a real hinge uses.
 */
export function Door({ id, label, hinge, rotationY, swing, width, height }: Props) {
    const body = useRef<RapierRigidBody>(null);
    const angle = useRef(0);
    const tmp = useMemo(() => ({ euler: new Euler(), quat: new Quaternion() }), []);

    useFrame((_, delta) => {
        const b = body.current;
        if (!b) return;
        const open = !!useWorld.getState().doors[id];
        const target = open ? swing * OPEN_ANGLE : 0;

        // Exponential smoothing: close a fixed fraction of the remaining gap
        // each second, whatever the frame rate. Fast at first, gently settling,
        // which reads as a door swinging on its weight. 1 - e^(-rate*dt) is the
        // fraction to cover this frame; on a 30 fps phone it's simply bigger.
        const t = 1 - Math.exp(-SWING_RATE * Math.min(delta, 0.1));
        angle.current += (target - angle.current) * t;
        if (Math.abs(target - angle.current) < 1e-4) angle.current = target;

        tmp.euler.set(0, rotationY + angle.current, 0);
        b.setNextKinematicRotation(tmp.quat.setFromEuler(tmp.euler));
    });

    const leafW = width - GAP * 2;
    const leafH = height - GAP;
    const cx = GAP + leafW / 2; // leaf centre along local x

    return (
        <RigidBody
            ref={body}
            type="kinematicPosition"
            colliders={false}
            position={[hinge[0], 0, hinge[1]]}
            rotation={[0, rotationY, 0]}
        >
            <CuboidCollider
                args={[leafW / 2, leafH / 2, LEAF_THICKNESS / 2]}
                position={[cx, leafH / 2, 0]}
            />
            <Interactable id={`door:${id}`} label={label} action={{ kind: 'door', door: id }}>
                <Block
                    size={[leafW, leafH, LEAF_THICKNESS]}
                    position={[cx, leafH / 2, 0]}
                    surface="wood"
                />
                {/* handles on both faces, near the latch side */}
                <Block
                    size={[0.14, 0.03, 0.04]}
                    position={[GAP + leafW - 0.15, 1.0, LEAF_THICKNESS / 2 + 0.03]}
                    surface="metal"
                />
                <Block
                    size={[0.14, 0.03, 0.04]}
                    position={[GAP + leafW - 0.15, 1.0, -LEAF_THICKNESS / 2 - 0.03]}
                    surface="metal"
                />
            </Interactable>
        </RigidBody>
    );
}
