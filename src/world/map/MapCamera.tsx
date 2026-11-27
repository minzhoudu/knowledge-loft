'use client';

import { useFrame } from '@react-three/fiber';
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { SHELL, STREET } from '@/world/outside/layout';
import { resumeFromKey } from '@/world/player/input';
import { playerControl } from '@/world/player/Player';
import { showCeilings } from './ceilings';
import { MAP_ROOMS } from './rooms';

const RISE = 1.2; // seconds
const DIVE = 1.1;
const RETURN = 0.9;
/** How steeply the overview looks down (radians below the horizon). */
const PITCH = 0.95;
const EYE = 1.65; // eye height you land at

/**
 * The camera for the map view (see the store's MapPhase).
 *
 * Opening the map saves where the camera is, then glides up to an overview:
 * looking down at the loft from the south (the street side) at ~55°, far
 * enough back that the whole building and the street in front of it fit
 * the window, whatever its shape. Picking a room moves the player's body to
 * that room's door first, then glides the camera down to eye height there;
 * closing the map glides back to the saved spot. Same easing and slerp as
 * SeatCamera.
 */

const rig = {
    phase: null as 'rising' | 'diving' | 'returning' | null,
    t: 0,
    fromPos: new Vector3(),
    fromQuat: new Quaternion(),
    toPos: new Vector3(),
    toQuat: new Quaternion(),
    homePos: new Vector3(),
    homeQuat: new Quaternion(),
};

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const look = new Matrix4();
const UP = new Vector3(0, 1, 0);
const euler = new Euler(0, 0, 0, 'YXZ');

const probe = new PerspectiveCamera();
const corner = new Vector3();

/**
 * The overview: the building plus the street, seen from the south at PITCH,
 * as close as fits. Rather than solving the perspective by hand (the near
 * edge of the area looks wider than the far one), it tries a distance,
 * projects the area's corners through a stand-in camera with the real
 * field of view and aspect ratio, and backs off until they're all inside
 * the frame with a margin. A few dozen cheap tries, once, when the map opens.
 */
function overview(camera: PerspectiveCamera, outPos: Vector3, outQuat: Quaternion) {
    const x0 = SHELL.west - 3;
    const x1 = SHELL.east + 3;
    const z0 = SHELL.corridorNorth - 3;
    const z1 = STREET.road[1];
    const target = new Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const corners: [number, number, number][] = [
        [x0, 0, z0],
        [x1, 0, z0],
        [x0, 0, z1],
        [x1, 0, z1],
        [x0, 5, z1], // top of the façade, nearest the camera
        [x1, 5, z1],
    ];
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = camera.near;
    probe.far = 1000;
    probe.updateProjectionMatrix();

    let d = 20;
    for (let i = 0; i < 60; i++, d *= 1.06) {
        outPos.set(target.x, Math.sin(PITCH) * d, target.z + Math.cos(PITCH) * d);
        look.lookAt(outPos, target, UP);
        outQuat.setFromRotationMatrix(look);
        probe.position.copy(outPos);
        probe.quaternion.copy(outQuat);
        probe.updateMatrixWorld();
        const fits = corners.every(([x, y, z]) => {
            corner.set(x, y, z).project(probe);
            return Math.abs(corner.x) < 0.94 && Math.abs(corner.y) < 0.86 && corner.z < 1;
        });
        if (fits) return;
    }
}

function start(
    phase: NonNullable<typeof rig.phase>,
    from: { position: Vector3; quaternion: Quaternion },
) {
    rig.phase = phase;
    rig.t = 0;
    rig.fromPos.copy(from.position);
    rig.fromQuat.copy(from.quaternion);
}

export function MapCamera() {
    useFrame(({ camera }, delta) => {
        const world = useWorld.getState();
        const phase = world.mapPhase;
        if (!phase) {
            rig.phase = null;
            return;
        }

        if (phase === 'rising' && rig.phase !== 'rising') {
            rig.homePos.copy(camera.position);
            rig.homeQuat.copy(camera.quaternion);
            start('rising', camera);
            overview(camera as PerspectiveCamera, rig.toPos, rig.toQuat);
            showCeilings(false);
        } else if (phase === 'diving' && rig.phase !== 'diving') {
            const room = world.mapTarget ? MAP_ROOMS[world.mapTarget] : null;
            if (!room) return;
            start('diving', camera);
            // Move the body first: when the camera arrives, Player takes over from there.
            playerControl.teleport?.(room.entry.x, room.entry.z);
            rig.toPos.set(room.entry.x, EYE, room.entry.z);
            rig.toQuat.setFromEuler(euler.set(0, room.entry.yaw, 0));
        } else if (phase === 'returning' && rig.phase !== 'returning') {
            start('returning', camera);
            rig.toPos.copy(rig.homePos);
            rig.toQuat.copy(rig.homeQuat);
        }
        if (phase === 'open') return; // hovering over the loft

        const seconds = rig.phase === 'rising' ? RISE : rig.phase === 'diving' ? DIVE : RETURN;
        rig.t = Math.min(1, rig.t + Math.min(delta, 0.05) / seconds);
        const e = smootherstep(rig.t);
        camera.position.lerpVectors(rig.fromPos, rig.toPos, e);
        camera.quaternion.slerpQuaternions(rig.fromQuat, rig.toQuat, e);
        if (rig.t < 1) return;

        if (rig.phase === 'rising') {
            world.setMapPhase('open');
        } else {
            // Landed (in a new room, or back where you were): walls up, walk on.
            rig.phase = null;
            showCeilings(true);
            world.setMapPhase(null);
            resumeFromKey(); // the map released the mouse, so it can be captured again
        }
    });

    return null;
}
