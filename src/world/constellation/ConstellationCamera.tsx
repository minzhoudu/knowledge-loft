'use client';

import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { resumeFromKey } from '@/world/player/input';
import { blend, INSIDE, smootherstep } from './immersion';

const STEP_IN = 1.4; // seconds
const STEP_OUT = 1.1;

/**
 * Carries you into the constellation and back out (see ConstellationPhase).
 *
 * Only the camera's position moves: from where you stand to the middle of
 * the cloud, and back. Its rotation stays yours, so you can keep looking
 * around with the mouse all the way in. One number drives everything,
 * `progress` (0 = standing in the lobby, 1 = inside); the cloud, the dark
 * room and the camera all read the same eased value (blend.t), so they
 * move as one. Stepping out halfway through stepping in simply runs the
 * same number back down from wherever it got to.
 */
const rig = {
    progress: 0,
    /** Where the camera was before stepping in: where stepping out returns to. */
    home: new Vector3(),
    active: false,
};
const eye = new Vector3(...INSIDE.centre);

export function ConstellationCamera() {
    useFrame(({ camera }, delta) => {
        const world = useWorld.getState();
        const phase = world.constellation;
        if (!phase) {
            rig.active = false;
            rig.progress = 0;
            blend.t = 0;
            return;
        }
        if (!rig.active) {
            rig.active = true;
            rig.home.copy(camera.position);
        }

        const step = Math.min(delta, 0.05); // after a stalled frame, don't jump to the end
        if (phase === 'leaving') rig.progress = Math.max(0, rig.progress - step / STEP_OUT);
        else rig.progress = Math.min(1, rig.progress + step / STEP_IN);
        blend.t = smootherstep(rig.progress);
        camera.position.lerpVectors(rig.home, eye, blend.t);

        if (phase === 'entering' && rig.progress >= 1) world.setConstellationPhase('inside');
        if (phase === 'leaving' && rig.progress <= 0) {
            rig.active = false;
            world.setConstellationPhase(null);
            // If Esc let go of the mouse on the way out, capture it again (or
            // fall back to drag-to-look until the next click).
            if (!document.pointerLockElement) resumeFromKey();
        }
    });

    return null;
}
