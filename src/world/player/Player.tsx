'use client';

import { useKeyboardControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { MARKERS } from '@/world/rooms/lobby/layout';
import type { Controls } from './controls';
import { joystick } from './input';

const WALK_SPEED = 2.2; // m/s, a relaxed walk
const RUN_SPEED = 4.0;
const CAPSULE_HALF_HEIGHT = 0.5; // the straight middle part
const CAPSULE_RADIUS = 0.3; // total height = 2 * (0.5 + 0.3) = 1.6 m
const EYE_OFFSET = 0.85; // body centre sits 0.8 m up, so eyes end up at ~1.65 m

/**
 * First-person player.
 *
 * The body is a dynamic physics capsule: Rapier handles gravity and
 * collisions, and each frame we set its horizontal velocity from the keys.
 * The camera isn't parented to the body; it copies the body's position every
 * frame and keeps its own rotation (set by mouse look). Keeping "movement"
 * and "camera" separate is what will make a third-person camera easy later.
 */
export function Player() {
    const body = useRef<RapierRigidBody>(null);
    const [, getKeys] = useKeyboardControls<Controls>();
    // `get` reads R3F's state without subscribing. three.js objects are mutated
    // in place by design, so we reach them through get()/the frame state rather
    // than through a hook's return value (which React's lint rules treat as frozen).
    const get = useThree((s) => s.get);

    // Reused every frame. Allocating new vectors 60x a second creates garbage
    // the browser has to collect, which shows up as stutters.
    const tmp = useMemo(() => ({ move: new Vector3(), yaw: new Euler(0, 0, 0, 'YXZ') }), []);

    useEffect(() => {
        const { camera } = get();
        camera.rotation.order = 'YXZ'; // yaw (Y) first, then pitch (X): standard for FPS cameras
        camera.rotation.set(0, MARKERS.spawn.yaw, 0);
    }, [get]);

    useFrame(({ camera }) => {
        const b = body.current;
        if (!b) return;

        const { forward, backward, left, right, run } = getKeys();
        const exploring = useWorld.getState().mode === 'exploring';

        // Input direction in "camera space": -z is forward, +x is right.
        // Keys give digital -1/0/1 per axis; the joystick adds an analog -1..1.
        tmp.move.set(
            exploring ? Number(right) - Number(left) + joystick.x : 0,
            0,
            exploring ? Number(backward) - Number(forward) + joystick.y : 0,
        );
        const amount = tmp.move.length();
        if (amount > 0) {
            // Cap at 1 so diagonals (or keys + stick) aren't faster, but keep values
            // below 1, so a half-pushed stick walks at half speed.
            if (amount > 1) tmp.move.divideScalar(amount);
            // Rotate by the camera's yaw only, so looking down doesn't slow you down.
            tmp.yaw.set(0, camera.rotation.y, 0);
            tmp.move.multiplyScalar(run ? RUN_SPEED : WALK_SPEED).applyEuler(tmp.yaw);
        }

        const v = b.linvel();
        b.setLinvel({ x: tmp.move.x, y: v.y, z: tmp.move.z }, true);

        const p = b.translation();
        camera.position.set(p.x, p.y + EYE_OFFSET, p.z);
    });

    return (
        <RigidBody
            ref={body}
            colliders={false}
            position={MARKERS.spawn.position}
            enabledRotations={[false, false, false]} // a capsule that can tip over is a bad day
            canSleep={false}
            linearDamping={0}
        >
            <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0} />
        </RigidBody>
    );
}
