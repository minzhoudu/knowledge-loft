'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useWorld } from '@/store/world';

const MAX_PITCH = 1.35; // radians (~77°): stop just short of straight up/down
/**
 * Look speed multiplier. 1 = dragging the full screen height turns the view by
 * one field of view (~65°). Raise it to turn faster, lower it for finer aim.
 */
const LOOK_SENSITIVITY = 2;

/**
 * Drag-to-look for touch screens (and desktops without pointer lock).
 *
 * Dragging across the canvas turns the camera: horizontal movement changes
 * yaw (turning left/right), vertical changes pitch (looking up/down). The
 * sensitivity scales with the field of view and screen height, so a drag of
 * the full screen height turns the view by roughly one screen's worth.
 *
 * The joystick sits in a DOM layer above the canvas, so a thumb on the
 * joystick never reaches this handler; only touches elsewhere do.
 */
export function DragLook() {
    const get = useThree((s) => s.get);

    useEffect(() => {
        const canvas = get().gl.domElement;
        let active: { id: number; x: number; y: number } | null = null;

        const onDown = (e: PointerEvent) => {
            const s = useWorld.getState();
            if (active || s.look !== 'drag' || s.mode !== 'exploring') return;
            active = { id: e.pointerId, x: e.clientX, y: e.clientY };
            canvas.setPointerCapture(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
            if (!active || e.pointerId !== active.id) return;
            const { camera, size } = get();
            const fov = 'fov' in camera ? (camera.fov as number) : 65;
            const radiansPerPixel = ((fov * Math.PI) / 180 / size.height) * LOOK_SENSITIVITY;
            camera.rotation.y -= (e.clientX - active.x) * radiansPerPixel;
            camera.rotation.x = Math.max(
                -MAX_PITCH,
                Math.min(MAX_PITCH, camera.rotation.x - (e.clientY - active.y) * radiansPerPixel),
            );
            active.x = e.clientX;
            active.y = e.clientY;
        };
        const onUp = (e: PointerEvent) => {
            if (active?.id === e.pointerId) active = null;
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        return () => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
        };
    }, [get]);

    return null;
}
