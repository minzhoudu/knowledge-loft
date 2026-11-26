'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useWorld } from '@/store/world';
import { lockRefused, pointerLock, RELOCK_COOLDOWN_MS } from './input';

const RADIANS_PER_PIXEL = 0.002; // same feel as three.js' PointerLockControls
const MAX_PITCH = 1.35; // radians (~77°), matches DragLook
/**
 * Ignore mouse movement this soon after the lock starts. While the browser
 * switches into pointer lock, the first event can carry the jump from
 * wherever the cursor was, which spins the camera.
 */
const SETTLE_MS = 80;
/**
 * A single event moving more than this many pixels is a browser glitch, not
 * a hand: Chrome occasionally reports huge movementX/Y values around lock
 * changes and window focus changes. Real fast flicks stay well below this.
 */
const MAX_JUMP = 250;

/**
 * Mouse look while the pointer is locked (desktop), replacing drei's
 * <PointerLockControls>. Doing it ourselves lets us:
 * - filter the glitchy jumps above (the "camera moves to a random spot" bug),
 * - track when the lock was released, so Resume can wait out the browser's
 *   re-lock cooldown instead of failing (see enterWorld),
 * - skip three.js' console error when the browser refuses a lock, which we
 *   already handle with a friendlier message.
 */
export function PointerLook() {
    const get = useThree((s) => s.get);

    useEffect(() => {
        const canvas = get().gl.domElement;
        let lockedAt = 0;
        let relockTimer: ReturnType<typeof setTimeout> | undefined;

        const onChange = () => {
            const s = useWorld.getState();
            if (document.pointerLockElement === canvas) {
                lockedAt = performance.now();
                s.set({
                    mode: 'exploring',
                    look: 'pointer-lock',
                    canLock: true,
                    relockOnClick: false,
                    lockFailed: false,
                });
            } else {
                const ours = pointerLock.releasingOurselves;
                pointerLock.releasingOurselves = false;
                if (!ours) {
                    // The visitor pressed Esc: the browser's re-lock cooldown starts,
                    // and Resume stays disabled until it's over.
                    s.set({ relocking: true });
                    clearTimeout(relockTimer);
                    relockTimer = setTimeout(
                        () => useWorld.getState().set({ relocking: false }),
                        RELOCK_COOLDOWN_MS,
                    );
                }
                // Released by Esc (or the browser) while walking = pause. Releasing to
                // read a panel is on purpose; the panel code already set the mode.
                if (s.mode === 'exploring' && s.look === 'pointer-lock') s.setMode('paused');
            }
        };

        const onMove = (e: MouseEvent) => {
            if (document.pointerLockElement !== canvas) return;
            if (useWorld.getState().mode !== 'exploring') return;
            if (performance.now() - lockedAt < SETTLE_MS) return;
            if (Math.abs(e.movementX) > MAX_JUMP || Math.abs(e.movementY) > MAX_JUMP) return;
            const { camera } = get();
            camera.rotation.y -= e.movementX * RADIANS_PER_PIXEL;
            camera.rotation.x = Math.max(
                -MAX_PITCH,
                Math.min(MAX_PITCH, camera.rotation.x - e.movementY * RADIANS_PER_PIXEL),
            );
        };

        // After Esc resumed play with drag-to-look, a click captures the mouse
        // again. A click is a real gesture, so the browser allows it.
        const onDown = (e: PointerEvent) => {
            const s = useWorld.getState();
            if (e.pointerType !== 'mouse' || s.mode !== 'exploring') return;
            if (!s.relockOnClick || !s.canLock || s.relocking) return;
            Promise.resolve(canvas.requestPointerLock()).catch(() => {}); // refused: keep dragging
        };

        // Older Safari reports a refused lock only through this event.
        const onError = lockRefused;

        document.addEventListener('pointerlockchange', onChange);
        document.addEventListener('pointerlockerror', onError);
        document.addEventListener('mousemove', onMove);
        canvas.addEventListener('pointerdown', onDown);
        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            document.removeEventListener('pointerlockchange', onChange);
            document.removeEventListener('pointerlockerror', onError);
            document.removeEventListener('mousemove', onMove);
            clearTimeout(relockTimer);
        };
    }, [get]);

    return null;
}
