'use client';

import { Html, useTexture } from '@react-three/drei';
import { about } from '@/content';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import { Quaternion, Vector3, type Mesh, type PerspectiveCamera } from 'three';
import { useWorld } from '@/store/world';
import { resumeFromKey } from '@/world/player/input';
import { CV_PAGE, SHEET } from './layout';
import { traySheet } from './Printer';

/**
 * The printed CV in your hands: lifted off the tray, held up in front of
 * you to read (and download, from the HUD), laid back in the tray.
 *
 * The same trip as a book from the shelf (CarriedBook), simpler: one
 * plane, no hinge. It flies from the tray sheet's pose to a spot in front
 * of the camera, sized so the page fits the view, and turns from lying
 * flat to facing you on the way, rising a little mid-flight, like a hand
 * lifting it.
 */
export function HeldSheet() {
    const phase = useWorld((s) => s.sheet);
    return phase ? (
        <Suspense fallback={null}>
            <Sheet />
        </Suspense>
    ) : null;
}

const FLY = 0.55; // seconds
/** Room around the page in your view (1 = edge to edge). */
const MARGIN = 1.2;
/** Held a little above the middle of the view, clear of the buttons at the bottom. */
const LIFT = 0.04;

const smootherstep = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
};

const trip = {
    started: false,
    mode: 'taking' as 'taking' | 'returning',
    t: 0,
    fromPos: new Vector3(),
    fromQuat: new Quaternion(),
    toPos: new Vector3(),
    toQuat: new Quaternion(),
};
const up = new Vector3();

function Sheet() {
    const texture = useTexture(CV_PAGE); // already loaded and set up by Printer
    const phase = useWorld((s) => s.sheet);
    const mesh = useRef<Mesh>(null);

    useEffect(() => {
        trip.started = false;
        return () => {
            trip.started = false;
        };
    }, []);

    useFrame(({ camera }, delta) => {
        const m = mesh.current;
        const tray = traySheet.current;
        const world = useWorld.getState();
        if (!m) return;

        if (!trip.started) {
            if (!tray) {
                world.setSheet(null);
                resumeFromKey();
                return;
            }
            trip.started = true;
            trip.mode = 'taking';
            trip.t = 0;
            tray.getWorldPosition(trip.fromPos);
            tray.getWorldQuaternion(trip.fromQuat);
            // Centred, as close as the page fits the view (see seatedPose in
            // seats.ts for the same fit, worked through).
            const cam = camera as PerspectiveCamera;
            const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
            const d = Math.max(
                (SHEET.length * MARGIN) / (2 * tanHalf),
                (SHEET.width * MARGIN) / (2 * tanHalf * cam.aspect),
            );
            camera.getWorldDirection(trip.toPos);
            up.set(0, 1, 0).applyQuaternion(camera.quaternion);
            trip.toPos
                .multiplyScalar(d)
                .add(camera.position)
                .addScaledVector(up, LIFT * 2 * d * tanHalf);
            trip.toQuat.copy(camera.quaternion);
            m.visible = true; // hidden until now, so it never flashes at the origin
        }

        if (world.sheet === 'returning' && trip.mode === 'taking') {
            // Back to the tray from wherever it is now, even mid-flight.
            trip.mode = 'returning';
            trip.t = 0;
            trip.toPos.copy(m.position);
            trip.toQuat.copy(m.quaternion);
        }
        if (world.sheet === 'held') return;

        trip.t += Math.min(delta, 0.05);
        const e = smootherstep(trip.t / FLY);
        const arc = Math.sin(Math.PI * e) * 0.08; // rise mid-flight
        if (trip.mode === 'taking') {
            m.position.lerpVectors(trip.fromPos, trip.toPos, e).y += arc;
            m.quaternion.slerpQuaternions(trip.fromQuat, trip.toQuat, e);
            if (e >= 1) world.setSheet('held');
        } else {
            // toPos/toQuat now hold where it started back from.
            m.position.lerpVectors(trip.toPos, trip.fromPos, e).y += arc;
            m.quaternion.slerpQuaternions(trip.toQuat, trip.fromQuat, e);
            if (e >= 1) {
                world.setSheet(null);
                resumeFromKey(); // we released the mouse when picking it up
            }
        }
    });

    return (
        <mesh ref={mesh} visible={false}>
            <planeGeometry args={[SHEET.width, SHEET.length]} />
            {/* Unlit: in flight, the page reads the same in any light. */}
            <meshBasicMaterial map={texture} />
            {phase === 'held' && <Page />}
        </mesh>
    );
}

/** The page's layout width in CSS px (one CSS px = distanceFactor / 400 world units, see SeatScreen). */
const PAGE_PX = 600;
const PX_PER_METRE = PAGE_PX / SHEET.width;

/**
 * Once it's in your hands, the page as a real <img> laid over the sheet,
 * like a book's pages. The 3D copy goes through the scene's tone mapping
 * (ACES), which turns white into a ~80% grey, and anything brighter than
 * white would bloom; HTML is drawn on top of the canvas, so it keeps the
 * picture's own paper-white and crisp text.
 */
function Page() {
    return (
        <Html
            transform
            distanceFactor={400 / PX_PER_METRE}
            position-z={0.001}
            zIndexRange={[10, 0]}
        >
            {/* eslint-disable-next-line @next/next/no-img-element -- a plain picture inside the 3D view, no layout to optimise */}
            <img
                src={CV_PAGE}
                alt={`${about.name}'s CV, page 1`}
                width={PAGE_PX}
                height={Math.round(SHEET.length * PX_PER_METRE)}
                draggable={false}
                className="block animate-[screen-on_0.3s_ease-out] select-none"
            />
        </Html>
    );
}
