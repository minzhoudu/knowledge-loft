'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Raycaster, Vector2, Vector3, type Intersection, type Object3D } from 'three';
import { useWorld } from '@/store/world';
import { interactables } from './Interactable';

const REACH = 3.5; // metres: how far away you can inspect something
const FAR_REACH = 6; // aim-assisted targets (stars) can be picked from across the room
const CENTER = new Vector2(0, 0); // the crosshair, in normalized screen coords
const centre = new Vector3();

/**
 * Aim assist for small, clustered targets (constellation stars). Their hit
 * spheres are generous so they're easy to hit, which means they overlap,
 * and plain raycasting would always pick the front one. Among the
 * overlapping aim-assisted hits, pick the one whose centre is closest to
 * the crosshair ray: the one you're actually pointing at.
 */
function pick(all: Intersection[], raycaster: Raycaster) {
    const hits = all.filter((h) => h.distance <= REACH || h.object.userData.aimAssist);
    const first = hits[0];
    if (!first?.object.userData.aimAssist) return first;
    let best = first;
    let bestDistance = Infinity;
    for (const hit of hits) {
        if (!hit.object.userData.aimAssist) break; // something else is in front of the rest
        const d = raycaster.ray.distanceToPoint(hit.object.getWorldPosition(centre));
        if (d < bestDistance) {
            bestDistance = d;
            best = hit;
        }
    }
    return best;
}

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
        r.far = FAR_REACH;
        return r;
    }, []);

    useFrame(() => {
        const { mode, focused, setFocused } = useWorld.getState();
        if (mode !== 'exploring') {
            if (focused) setFocused(null);
            return;
        }

        raycaster.setFromCamera(CENTER, camera);
        const hit = pick(raycaster.intersectObjects([...interactables.values()], true), raycaster);

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
