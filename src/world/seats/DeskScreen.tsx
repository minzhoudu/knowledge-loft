'use client';

import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { about } from '@/content';
import { useWorld, type SeatId } from '@/store/world';
import { Section } from '@/ui/sections';
import { SEATS, type Seat } from './seats';

/** CSS pixels per metre of screen: the page is laid out at this size, then scaled into place. */
const PX_PER_M = 1000;
/** Smallest comfortable reading size on the visitor's display, in CSS px. */
const MIN_TEXT_PX = 15;

/**
 * A monitor's picture, for a seat (see seats.ts).
 *
 * Two layers, on purpose:
 * - Always: a lit "terminal" image, drawn once into a canvas texture. It's a
 *   real 3D surface, so it's lit, reflected and bloomed like everything else,
 *   and it's what you see from across the room.
 * - While seated: the actual page, as real HTML (drei's <Html transform>).
 *   drei gives the element the same perspective transform as the screen
 *   (a CSS matrix3d computed from the camera), so it looks painted on the
 *   monitor but stays DOM: sharp text, scrolling, clickable links, and the
 *   same React component the panels and the quick view use. The catch is
 *   that DOM sits on top of the canvas, ignoring depth: anything in front of
 *   the screen wouldn't hide it. That's why it only appears once you're
 *   seated, square in front of the screen with nothing in between.
 */
export function DeskScreen({ seat }: { seat: SeatId }) {
    const { screen, page } = SEATS[seat];
    const reading = useWorld((s) => s.seat === seat && s.seatPhase === 'seated');
    const texture = useMemo(() => drawIdle(screen.width, screen.height), [screen]);
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        <group position={screen.center} rotation-y={screen.rotationY}>
            <mesh position-z={0.001}>
                <planeGeometry args={[screen.width, screen.height]} />
                {/* Glossy black glass that emits its picture. */}
                <meshStandardMaterial
                    color="#050505"
                    roughness={0.18}
                    metalness={0}
                    emissive="#ffffff"
                    emissiveMap={texture}
                    emissiveIntensity={0.85}
                />
            </mesh>
            {reading && <ScreenPage seat={SEATS[seat]} title={page.title} section={page.section} />}
        </group>
    );
}

const left = new Vector3();
const right = new Vector3();

function ScreenPage({
    seat,
    title,
    section,
}: {
    seat: Seat;
    title: string;
    section: Seat['page']['section'];
}) {
    const { screen } = seat;
    const get = useThree((s) => s.get);
    const size = useThree((s) => s.size);
    const w = Math.round(screen.width * PX_PER_M);
    const h = Math.round(screen.height * PX_PER_M);

    // How big will the page look? Project the screen's left and right edges
    // into the viewport and compare with the page's layout width. On a large
    // display it's scaled up (fine); on a phone it's scaled way down, so the
    // text is zoomed back up to stay readable, and you scroll more instead.
    const zoom = useMemo(() => {
        const { camera } = get();
        const [x, y, z] = screen.center;
        const c = Math.cos(screen.rotationY);
        const s = Math.sin(screen.rotationY);
        const half = screen.width / 2;
        left.set(x - c * half, y, z + s * half).project(camera);
        right.set(x + c * half, y, z - s * half).project(camera);
        const onScreenPx = (Math.abs(right.x - left.x) / 2) * size.width;
        const scale = onScreenPx / w;
        return Math.min(2.5, Math.max(1, MIN_TEXT_PX / (16 * scale)));
    }, [get, screen, size.width, w]);

    return (
        <Html
            transform
            // drei scales a transformed element so one CSS px is distanceFactor/400 world units.
            distanceFactor={400 / PX_PER_M}
            position-z={0.002}
            zIndexRange={[10, 0]}
        >
            <div
                style={{ width: w, height: h }}
                // Opaque black underneath: bg-panel (which also switches the text
                // colours to their dark-panel values) is translucent by design.
                className="animate-[screen-on_0.35s_ease-out] overflow-hidden bg-[#0e0f11]"
            >
                <div className="bg-panel flex size-full flex-col text-fg">
                    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2 font-mono text-xs text-muted">
                        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="size-2.5 rounded-full bg-[#febc2e]" />
                        <span className="size-2.5 rounded-full bg-[#28c840]" />
                        <span className="ml-2">{title}</span>
                        <span className="ml-auto">Esc · stand up</span>
                    </div>
                    <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6"
                        style={{ zoom }}
                    >
                        <Section id={section} />
                    </div>
                </div>
            </div>
        </Html>
    );
}

/** The idle picture: a terminal that has just printed who sits here. */
function drawIdle(width: number, height: number) {
    const css = getComputedStyle(document.documentElement);
    const mono = css.getPropertyValue('--font-plex-mono').trim() || 'ui-monospace, monospace';
    const cw = Math.round(width * 800);
    const ch = Math.round(height * 800);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext('2d')!;

    const bg = g.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#15181c');
    bg.addColorStop(1, '#0c0d10');
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);

    const x = 40;
    let y = 70;
    const line = (text: string, color: string, size = 26) => {
        g.font = `500 ${size}px ${mono}`;
        g.fillStyle = color;
        g.fillText(text, x, y);
        y += size * 1.6;
    };
    const prompt = '#7fd18b';
    line('~ $ whoami', prompt);
    line(about.name, '#ece8e2', 34);
    line(about.headline, '#a39d94');
    y += 14;
    line('~ $ cat about.md', prompt);
    line('Take a seat to read it.', '#a39d94');
    g.fillStyle = '#ece8e2';
    g.fillRect(x, y - 24, 16, 28); // cursor

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
