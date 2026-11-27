'use client';

import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, type ReactNode } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { useWorld, type SeatId } from '@/store/world';
import { readableZoom } from '@/world/reading';
import { Section } from '@/ui/sections';
import { KioskChat } from '@/world/kiosk/KioskChat';
import { SEATS, type IdleLine, type Seat } from './seats';

/**
 * Every screen's page is laid out this many CSS px wide, then scaled to fit
 * the glass. A fixed layout width keeps lines a readable length on a small
 * monitor and a big wall display alike.
 */
const PAGE_WIDTH = 960;

/**
 * A screen's picture, for a seat (see seats.ts).
 *
 * Two layers, on purpose:
 * - Always: a lit "terminal" image, drawn once into a canvas texture. It's a
 *   real 3D surface, so it's lit, reflected and bloomed like everything else,
 *   and it's what you see from across the room.
 * - While you're at it: the actual page, as real HTML (drei's <Html transform>).
 *   drei gives the element the same perspective transform as the screen
 *   (a CSS matrix3d computed from the camera), so it looks painted on the
 *   glass but stays DOM: sharp text, scrolling, clickable links, and the
 *   same React component the panels and the quick view use. The catch is
 *   that DOM sits on top of the canvas, ignoring depth: anything in front of
 *   the screen wouldn't hide it. That's why it only appears once you're
 *   square in front of the screen with nothing in between.
 */
export function SeatScreen({ seat }: { seat: SeatId }) {
    const config = SEATS[seat];
    const { screen } = config;
    const content = config.page ?? config.chat;
    const idle = content?.idle;
    const reading = useWorld((s) => s.seat === seat && s.seatPhase === 'seated');
    const texture = useMemo(
        () => drawIdle(screen.width, screen.height, idle ?? []),
        [screen, idle],
    );
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        // Turn to face rotationY, after tipping back by tiltUp (Euler order YXZ).
        <group
            position={screen.center}
            rotation={[-(screen.tiltUp ?? 0), screen.rotationY, 0, 'YXZ']}
        >
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
            {reading && config.page && (
                <ScreenPage seat={config} title={config.page.title}>
                    <Section id={config.page.section} />
                </ScreenPage>
            )}
            {reading && config.chat && (
                <ScreenPage seat={config} title={config.chat.title} scroll={false}>
                    <KioskChat />
                </ScreenPage>
            )}
        </group>
    );
}

const left = new Vector3();
const right = new Vector3();

/**
 * The live screen: real HTML in a window frame, laid onto the glass. Its
 * content scrolls (a page), or manages its own layout (the kiosk's chat).
 */
function ScreenPage({
    seat,
    title,
    scroll = true,
    children,
}: {
    seat: Seat;
    title: string;
    scroll?: boolean;
    children: ReactNode;
}) {
    const { screen } = seat;
    const get = useThree((s) => s.get);
    const size = useThree((s) => s.size);
    const pxPerMetre = PAGE_WIDTH / screen.width;
    const w = PAGE_WIDTH;
    const h = Math.round(screen.height * pxPerMetre);

    // Zoom the text back up if the page will look too small (see readableZoom).
    const zoom = useMemo(() => {
        const [x, y, z] = screen.center;
        const c = Math.cos(screen.rotationY);
        const s = Math.sin(screen.rotationY);
        const half = screen.width / 2;
        left.set(x - c * half, y, z + s * half);
        right.set(x + c * half, y, z - s * half);
        return readableZoom(get().camera, size.width, left, right, w);
    }, [get, screen, size.width, w]);

    return (
        <Html
            transform
            // drei scales a transformed element so one CSS px is distanceFactor/400 world units.
            distanceFactor={400 / pxPerMetre}
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
                        <span className="ml-auto">Esc · {seat.leave.toLowerCase()}</span>
                    </div>
                    <div
                        className={`min-h-0 flex-1 ${
                            scroll
                                ? 'overflow-y-auto overscroll-contain px-8 py-6'
                                : 'flex flex-col'
                        }`}
                        style={{ zoom }}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </Html>
    );
}

const TONES: Record<IdleLine['tone'], { color: string; size: number }> = {
    prompt: { color: '#7fd18b', size: 26 },
    title: { color: '#ece8e2', size: 34 },
    text: { color: '#ece8e2', size: 26 },
    muted: { color: '#a39d94', size: 26 },
};

/**
 * The idle picture: a terminal that has just printed something. Sizes are
 * for a desk monitor (0.92 m wide) and scale with the screen, so a wall
 * display shows the same terminal, bigger.
 */
function drawIdle(width: number, height: number, lines: IdleLine[]) {
    const css = getComputedStyle(document.documentElement);
    const mono = css.getPropertyValue('--font-plex-mono').trim() || 'ui-monospace, monospace';
    const cw = Math.round(width * 800);
    const ch = Math.round(height * 800);
    let k = cw / 736; // 1 on the desk monitor
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext('2d')!;

    const bg = g.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#15181c');
    bg.addColorStop(1, '#0c0d10');
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);

    // Shrink everything evenly if the longest line wouldn't fit the glass.
    const x = 40 * k;
    let widest = 0;
    for (const { text, tone } of lines) {
        g.font = `500 ${TONES[tone].size * k}px ${mono}`;
        widest = Math.max(widest, g.measureText(text).width);
    }
    k *= Math.min(1, (cw - 2 * x) / widest);

    let y = 70 * k;
    for (const { text, tone } of lines) {
        const { color, size } = TONES[tone];
        g.font = `500 ${size * k}px ${mono}`;
        g.fillStyle = color;
        g.fillText(text, x, y);
        y += (text ? size * 1.6 : 14) * k;
    }
    g.fillStyle = '#ece8e2';
    g.fillRect(x, y - 24 * k, 16 * k, 28 * k); // cursor

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
