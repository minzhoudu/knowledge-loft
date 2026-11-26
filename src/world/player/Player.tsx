'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { MARKERS } from '@/world/rooms/lobby/layout';
import { held, useKeyboard } from './controls';
import { joystick } from './input';

const WALK_SPEED = 2.2; // m/s, a relaxed walk
const RUN_SPEED = 4.0;
const CAPSULE_HALF_HEIGHT = 0.5; // the straight middle part
const CAPSULE_RADIUS = 0.3; // total height = 2 * (0.5 + 0.3) = 1.6 m
const EYE_OFFSET = 0.85; // body centre sits 0.8 m up, so eyes end up at ~1.65 m
const GROUND_PROBE = 3; // metres: how far below the spawn point we look for a floor
const FELL_OUT = -10; // below this height you've fallen out of the world

/**
 * First-person player.
 *
 * The body is a dynamic physics capsule: Rapier handles gravity and
 * collisions, and each frame we set its horizontal velocity from the keys.
 * The camera isn't parented to the body; it copies the body's position every
 * frame and keeps its own rotation (set by mouse look). Keeping "movement"
 * and "camera" separate is what will make a third-person camera easy later.
 *
 * Spawning safely: on a slow first load, the player's body can be created a
 * few frames before the room's floor colliders. With gravity on, it would
 * drop through the empty space where the floor is about to be, and never
 * come back. So the body starts weightless, frozen in place, and each frame
 * casts a ray straight down; gravity switches on only once that ray hits a
 * floor. If you ever end up below the world anyway, you're put back at the
 * spawn point.
 */
export function Player() {
    const body = useRef<RapierRigidBody>(null);
    useKeyboard();
    // `get` reads R3F's state without subscribing. three.js objects are mutated
    // in place by design, so we reach them through get()/the frame state rather
    // than through a hook's return value (which React's lint rules treat as frozen).
    const get = useThree((s) => s.get);
    const { world, rapier } = useRapier();
    const grounded = useRef(false); // has a floor been found under the spawn point?

    // Reused every frame. Allocating new vectors 60x a second creates garbage
    // the browser has to collect, which shows up as stutters.
    const tmp = useMemo(() => ({ move: new Vector3(), yaw: new Euler(0, 0, 0, 'YXZ') }), []);

    useEffect(() => {
        const { camera } = get();
        camera.rotation.order = 'YXZ'; // yaw (Y) first, then pitch (X): standard for FPS cameras
        camera.rotation.set(0, MARKERS.spawn.yaw, 0);
    }, [get]);

    // Dev-only: __teleport(x, z, yaw) from the console, for checking far-away rooms.
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;
        const teleport = (x: number, z: number, yaw?: number) => {
            body.current?.setTranslation({ x, y: 1, z }, true);
            if (yaw !== undefined) get().camera.rotation.set(0, yaw, 0);
        };
        Object.assign(window, { __teleport: teleport, __physics: world, __player: body });
    }, [get, world]);

    useFrame(({ camera }) => {
        const b = body.current;
        if (!b) return;

        const forward = held('forward');
        const backward = held('backward');
        const left = held('left');
        const right = held('right');
        const run = held('run');
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

        const p = b.translation();
        if (p.y < FELL_OUT) {
            // Fell out of the world: back to the start, weightless until a floor is found.
            const [sx, sy, sz] = MARKERS.spawn.position;
            b.setTranslation({ x: sx, y: sy, z: sz }, true);
            b.setLinvel({ x: 0, y: 0, z: 0 }, true);
            b.setGravityScale(0, true);
            grounded.current = false;
        }
        if (!grounded.current) {
            b.setLinvel({ x: 0, y: 0, z: 0 }, true);
            const ray = new rapier.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: -1, z: 0 });
            // EXCLUDE_DYNAMIC: ignore moving bodies (including our own capsule).
            const floor = world.castRay(
                ray,
                GROUND_PROBE,
                true,
                rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
            );
            if (floor) {
                b.setGravityScale(1, true);
                grounded.current = true;
            }
        } else {
            const v = b.linvel();
            b.setLinvel({ x: tmp.move.x, y: v.y, z: tmp.move.z }, true);
        }

        // Sitting at a screen: SeatCamera moves the camera instead (the body stays put).
        if (useWorld.getState().seat) return;
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
            gravityScale={0} // weightless until the floor below is found (see above)
        >
            <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0} />
        </RigidBody>
    );
}
