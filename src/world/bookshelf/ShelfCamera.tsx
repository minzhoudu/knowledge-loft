'use client';

import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { held } from '@/world/player/controls';
import { joystick, resumeFromKey } from '@/world/player/input';
import { BROWSE } from './browse';

const ARRIVE = 0.9; // seconds
const LEAVE = 0.7;

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, v));

/** The shortest turn from one angle to another, in (-π, π]. */
function turn(from: number, to: number) {
    const d = (to - from) % (Math.PI * 2);
    return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

/**
 * Steps you up to the bookshelf, slides you along it, and steps you back
 * (see ShelfPhase and browse.ts).
 *
 * Arriving glides you to the middle of the shelf and squares you up to it.
 * Browsing, the view never turns: PointerLook and DragLook still turn the
 * camera as they always do, and each frame this reads how far they turned
 * it, moves the camera sideways and up by as much instead, and turns it
 * straight again. Mouse look becomes a slide without either of them
 * knowing about the shelf. WASD and the joystick slide it too, since
 * walking is off here anyway.
 *
 * The yaw you arrive at is the one closest to the shelf from wherever you
 * were facing, not BROWSE.yaw itself: the camera's yaw keeps counting up as
 * you spin around the loft (7.5 rad is a valid way to face the shelf).
 */
const rig = {
    progress: 0,
    active: false,
    /** Where you stood: where stepping back returns to. */
    home: new Vector3(),
    /** Where you are at the shelf (the slide moves it). */
    at: new Vector3(),
    fromYaw: 0,
    fromPitch: 0,
    yaw: 0,
};

export function ShelfCamera() {
    useFrame(({ camera }, delta) => {
        const world = useWorld.getState();
        const phase = world.shelf;
        if (!phase) {
            rig.active = false;
            rig.progress = 0;
            return;
        }
        if (!rig.active) {
            rig.active = true;
            rig.home.copy(camera.position);
            rig.at.set(BROWSE.start[0], BROWSE.start[1], BROWSE.z);
            rig.fromYaw = camera.rotation.y;
            rig.fromPitch = camera.rotation.x;
            rig.yaw = rig.fromYaw + turn(rig.fromYaw, BROWSE.yaw);
        }

        const step = Math.min(delta, 0.05); // after a stalled frame, don't jump to the end
        if (phase === 'leaving') rig.progress = Math.max(0, rig.progress - step / LEAVE);
        else rig.progress = Math.min(1, rig.progress + step / ARRIVE);
        const t = smootherstep(rig.progress);

        if (phase === 'arriving') {
            // The glide owns the view for under a second; the mouse waits.
            camera.rotation.y = rig.fromYaw + (rig.yaw - rig.fromYaw) * t;
            camera.rotation.x = rig.fromPitch * (1 - t);
            if (rig.progress >= 1) world.setShelfPhase('browsing');
        } else if (phase === 'browsing') {
            // Whatever the mouse turned this frame becomes a slide. Turning
            // left (yaw up) slides left; looking up (pitch up) slides up.
            const k = BROWSE.metresPerRadian;
            let dx = -(camera.rotation.y - rig.yaw) * k;
            let dy = camera.rotation.x * k;
            camera.rotation.set(0, rig.yaw, 0);
            if (world.mode === 'exploring') {
                const keys = BROWSE.speed * step;
                dx += (Number(held('right')) - Number(held('left')) + joystick.x) * keys;
                dy += (Number(held('forward')) - Number(held('backward')) - joystick.y) * keys;
            }
            rig.at.x = clamp(rig.at.x + dx, BROWSE.x);
            rig.at.y = clamp(rig.at.y + dy, BROWSE.y);
        } else if (rig.progress <= 0) {
            rig.active = false;
            world.setShelfPhase(null);
            // If Esc let go of the mouse, capture it again (or fall back to
            // drag-to-look until the next click).
            if (!document.pointerLockElement) resumeFromKey();
        }

        camera.position.lerpVectors(rig.home, rig.at, t);
    });

    return null;
}
