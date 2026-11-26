'use client';

import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { useWorld } from '@/store/world';
import { resumeFromKey } from '@/world/player/input';
import { SEATS, seatedPose } from './seats';

const SIT_SECONDS = 0.9;
const STAND_SECONDS = 0.65;
/** Sitting down dips the view a little mid-glide, like lowering yourself into a chair. */
const DIP = 0.07;

/**
 * Moves the camera when you sit down at a screen, and back when you get up.
 *
 * The player's physics body stays where it is; only the camera travels.
 * While a seat is in use, Player stops copying the body's position into the
 * camera, so this component owns it. Getting up glides back to exactly where
 * the camera was, and Player takes over again from the same spot.
 *
 * A glide is an interpolation between two poses, eased:
 * - position: a straight line (lerp), plus a small dip on the way down;
 * - rotation: quaternion slerp. Interpolating yaw and pitch angles separately
 *   can swing the long way round or wobble; a slerp turns along the shortest
 *   arc at a steady rate.
 * - easing: smootherstep, so the glide starts and stops gently (zero speed
 *   and zero acceleration at both ends).
 */

// Module-level so the render loop allocates nothing.
const rig = {
    phase: null as 'arriving' | 'leaving' | null,
    t: 0,
    fromPos: new Vector3(),
    fromQuat: new Quaternion(),
    toPos: new Vector3(),
    toQuat: new Quaternion(),
    /** Where the camera was before sitting down: where getting up returns to. */
    homePos: new Vector3(),
    homeQuat: new Quaternion(),
};

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export function SeatCamera() {
    useFrame(({ camera }, delta) => {
        const world = useWorld.getState();
        const { seat, seatPhase } = world;
        if (!seat || !seatPhase) {
            rig.phase = null;
            return;
        }

        // A new glide starts: from wherever the camera is now.
        if (seatPhase === 'arriving' && rig.phase !== 'arriving') {
            rig.phase = 'arriving';
            rig.t = 0;
            rig.homePos.copy(camera.position);
            rig.homeQuat.copy(camera.quaternion);
            rig.fromPos.copy(camera.position);
            rig.fromQuat.copy(camera.quaternion);
            seatedPose(SEATS[seat].screen, camera as PerspectiveCamera, rig.toPos, rig.toQuat);
        } else if (seatPhase === 'leaving' && rig.phase !== 'leaving') {
            // Also works when getting up halfway through sitting down.
            rig.phase = 'leaving';
            rig.t = 0;
            rig.fromPos.copy(camera.position);
            rig.fromQuat.copy(camera.quaternion);
            rig.toPos.copy(rig.homePos);
            rig.toQuat.copy(rig.homeQuat);
        }
        if (seatPhase === 'seated') return; // parked in front of the screen

        const seconds = rig.phase === 'arriving' ? SIT_SECONDS : STAND_SECONDS;
        // Cap the step: after a stalled frame (tab switch) don't jump to the end.
        rig.t = Math.min(1, rig.t + Math.min(delta, 0.05) / seconds);
        const e = smootherstep(rig.t);
        camera.position.lerpVectors(rig.fromPos, rig.toPos, e);
        camera.position.y -= Math.sin(Math.PI * e) * DIP;
        camera.quaternion.slerpQuaternions(rig.fromQuat, rig.toQuat, e);

        if (rig.t < 1) return;
        if (rig.phase === 'arriving') {
            world.setSeatPhase('seated');
        } else {
            rig.phase = null;
            world.setSeatPhase(null);
            // We released the mouse when sitting down, so it can be captured
            // again now without a click (falls back to drag-to-look if not).
            resumeFromKey();
        }
    });

    return null;
}
