'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Raycaster, Vector2, type Object3D } from 'three';
import { useWorld } from '@/store/world';
import { interactables } from './Interactable';

const REACH = 3.5; // metres: how far away you can inspect something
const CENTER = new Vector2(0, 0); // the crosshair, in normalized screen coords

/**
 * Every frame, cast a ray from the camera through the centre of the screen
 * and see whether it hits a registered interactable within reach.
 *
 * The store is only written when the focused object actually changes, so
 * React (the HUD prompt) re-renders a handful of times, not 60 times a second.
 */
export function InteractionSystem() {
    const camera = useThree((s) => s.camera);
    const raycaster = useMemo(() => {
        const r = new Raycaster();
        r.far = REACH;
        return r;
    }, []);

    useFrame(() => {
        const { mode, focused, setFocused } = useWorld.getState();
        if (mode !== 'exploring') {
            if (focused) setFocused(null);
            return;
        }

        raycaster.setFromCamera(CENTER, camera);
        const hit = raycaster.intersectObjects([...interactables.values()], true)[0];

        let next: typeof focused = null;
        let obj: Object3D | null = hit?.object ?? null;
        while (obj && !next) {
            if (obj.userData.interactable) next = obj.userData.interactable;
            obj = obj.parent;
        }
        if (next?.id !== focused?.id) setFocused(next);
    });

    return null;
}
