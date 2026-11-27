'use client';

import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useRef } from 'react';
import {
    SRGBColorSpace,
    type Mesh,
    type MeshBasicMaterial,
    type MeshStandardMaterial,
} from 'three';
import { useWorld } from '@/store/world';
import { Block } from '@/world/greybox/Block';
import { Interactable } from '@/world/interaction/Interactable';
import { CABINET, CV_PAGE, PRINTER, SHEET } from './layout';
import { playPrint } from './sound';

/**
 * The CV printer by the desk. Use it and it prints the CV: a chime, the
 * motor, and a sheet sliding out of the slot onto the tray. Use it again
 * and you pick the sheet up (HeldSheet), to read it and download the PDF.
 *
 * The sheet coming out of the slot: the part still inside the printer
 * mustn't show, and the hump is shallower than a page is long, so a whole
 * sheet sliding forward would poke out of the printer's back. Instead the
 * sheet *grows* out of the slot: the plane is scaled to the length that's
 * out (f), and its texture is cropped to the same part of the page
 * (texture.repeat), so the picture doesn't squash. Page bottom first, as
 * the leading edge.
 */

/** The print, in seconds: wake up, feed the sheet, settle. */
const WAKE = 0.6;
const FEED = 2.4;
const DONE = WAKE + FEED + 0.4;

const smootherstep = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
};

/** The sheet lying in the tray: where HeldSheet picks it up from and lays it back. */
export const traySheet: { current: Mesh | null } = { current: null };

const job = { t: -1 };

const BODY = '#d9d5cc'; // warm light grey plastic: stands out against the dark loft
const DARK = '#1c1d20';

export function Printer() {
    const phase = useWorld((s) => s.printer);
    const sheet = useRef<Mesh>(null);
    const led = useRef<Mesh>(null);
    const texture = useTexture(CV_PAGE, (t) => {
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 8;
    });

    useFrame((_, delta) => {
        const w = useWorld.getState();
        const s = sheet.current;
        const l = led.current;
        if (!s || !l) return;

        let out = 0; // how much of the sheet is out of the slot, 0..1
        if (w.printer === 'printing') {
            if (job.t < 0) {
                job.t = 0;
                playPrint(PRINTER.position, [WAKE, WAKE + FEED], DONE);
            }
            job.t += Math.min(delta, 0.05);
            out = smootherstep((job.t - WAKE) / FEED);
            if (job.t >= DONE) {
                job.t = -1;
                w.setPrinter('printed');
            }
        } else if (w.printer === 'printed') {
            out = 1;
        }

        s.visible = out > 0.002 && !w.sheet; // in your hands, it's HeldSheet's
        s.scale.y = Math.max(out, 0.001);
        s.position.z = PRINTER.humpFront + (out * SHEET.length) / 2;
        const map = (s.material as MeshStandardMaterial).map;
        if (map) map.repeat.y = Math.max(out, 0.001);

        // The status light: blinks while printing, steady green otherwise.
        const blink = w.printer === 'printing' && Math.sin(job.t * 14) < 0;
        (l.material as MeshBasicMaterial).color.setRGB(0.2, blink ? 0.35 : 1.6, blink ? 0.15 : 0.6);
    });

    const { width: W, depth: D, tray, humpFront, top } = PRINTER;
    const humpDepth = humpFront + D / 2;
    const [cw, ch, cd] = CABINET.size;

    return (
        <>
            {/* a low steel cabinet: two drawers, the printer on top */}
            <RigidBody type="fixed" colliders={false} position={CABINET.position}>
                <CuboidCollider
                    args={[cw / 2, (ch + 0.26) / 2, cd / 2]}
                    position={[0, (ch + 0.26) / 2, 0]}
                />
            </RigidBody>
            <group position={CABINET.position}>
                <Block size={[cw, ch, cd]} position={[0, ch / 2, 0]} surface="metal" />
                {[0.2, 0.43].map((y) => (
                    <group key={y}>
                        {/* the gap above each drawer, and its pull */}
                        <Block
                            size={[cw - 0.04, 0.006, 0.004]}
                            position={[0, y + 0.1, cd / 2 + 0.001]}
                            color={DARK}
                        />
                        <Block
                            size={[0.14, 0.014, 0.018]}
                            position={[0, y, cd / 2 + 0.009]}
                            surface="metal"
                        />
                    </group>
                ))}
            </group>

            <Interactable
                id="printer"
                label={phase === 'printed' ? 'CV · fresh off the printer' : 'Printer · My CV'}
                action={phase === 'printed' ? { kind: 'sheet' } : { kind: 'print' }}
                enabled={phase !== 'printing'}
            >
                <group position={PRINTER.position}>
                    {/* the body, with the tray on top */}
                    <Block size={[W, tray, D]} position={[0, tray / 2, 0]} color={BODY} />
                    {/* the hump across the back, the output slot in its front face */}
                    <Block
                        size={[W, top - tray, humpDepth]}
                        position={[0, (top + tray) / 2, -D / 2 + humpDepth / 2]}
                        color={BODY}
                    />
                    <Block
                        size={[SHEET.width + 0.03, 0.012, 0.004]}
                        position={[0, tray + 0.012, humpFront + 0.001]}
                        color={DARK}
                    />
                    {/* the paper cassette: its seam and handle, low on the front */}
                    <Block
                        size={[W - 0.04, 0.004, 0.003]}
                        position={[0, 0.075, D / 2 + 0.001]}
                        color="#8d8a84"
                    />
                    <Block
                        size={[0.13, 0.014, 0.004]}
                        position={[0, 0.04, D / 2 + 0.001]}
                        color={DARK}
                    />
                    {/* the control panel, front right of the tray, and its status light */}
                    <Block
                        size={[0.075, 0.006, 0.06]}
                        position={[W / 2 - 0.055, tray + 0.003, D / 2 - 0.045]}
                        color={DARK}
                    />
                    <mesh
                        ref={led}
                        position={[W / 2 - 0.035, tray + 0.0065, D / 2 - 0.03]}
                        rotation-x={-Math.PI / 2}
                    >
                        <circleGeometry args={[0.005, 16]} />
                        <meshBasicMaterial color={[0.2, 1.6, 0.6]} toneMapped={false} />
                    </mesh>

                    {/* the sheet, lying in the tray face up, top of the page toward the slot */}
                    <mesh
                        ref={(m) => {
                            sheet.current = m;
                            traySheet.current = m;
                        }}
                        position={[0, tray + 0.002, humpFront]}
                        rotation-x={-Math.PI / 2}
                        visible={false}
                    >
                        <planeGeometry args={[SHEET.width, SHEET.length]} />
                        <meshStandardMaterial
                            map={texture}
                            roughness={0.9}
                            emissive="#ffffff"
                            emissiveMap={texture}
                            emissiveIntensity={0.12}
                        />
                    </mesh>
                </group>
            </Interactable>
        </>
    );
}
