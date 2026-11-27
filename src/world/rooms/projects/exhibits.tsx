'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import { companies, skillName, type Project } from '@/content';
import { Block } from '@/world/greybox/Block';
import { Model } from '@/world/models/Model';
import { roomFor } from '@/world/rooms/career/layout';
import { ROOM as HOBBIES } from '@/world/rooms/hobbies/layout';
import { ROOM as LOBBY } from '@/world/rooms/lobby/layout';
import { ROOM as PROJECTS } from './layout';

/**
 * The gallery's displays: what each project's exhibit holds, and the pieces
 * every exhibit is built from (plinth, glass case, plaque).
 *
 * Every exhibit's object stands for what the project was: a tyre for the
 * tyre-shop booking platform, a barber's chair in miniature for the hair
 * studio's, and so on. Objects are in the case's own frame: y = 0 is the case floor, +z faces
 * the visitor. Anything not listed gets an empty case, so a new project in
 * the content still shows up (just without a prop) until it's given one.
 */

/** Plinth and case sizes, in metres. */
export const PLINTH = { size: 0.55, height: 0.95 };
const CASE = { size: 0.52, height: 0.5 };

type Display = {
    /** What sits on the case floor. */
    items: ReactNode;
};

export const DISPLAYS: Record<string, Display> = {
    'knowledge-loft': { items: <MiniLoft /> },
    'florbs-workspace-security': {
        items: <Model name="padlock" scale={0.75} rotationY={0.35} collider={false} />,
    },
    'ai-energy-booking': {
        items: (
            <>
                <Model name="solar-panel" scale={0.26} position={[0, 0, -0.06]} collider={false} />
                <Model name="led-bulb" scale={1.6} position={[0.16, 0, 0.15]} collider={false} />
            </>
        ),
    },
    'source-greenhouse-analytics': {
        items: <Model name="terrarium" scale={1.45} collider={false} />,
    },
    'lilly-drogerie': {
        items: (
            <>
                <Model
                    name="perfume"
                    scale={1.9}
                    position={[-0.1, 0, 0.06]}
                    rotationY={0.4}
                    collider={false}
                />
                <Model
                    name="spray-bottle"
                    scale={0.9}
                    position={[0.13, 0, -0.06]}
                    rotationY={-0.5}
                    collider={false}
                />
            </>
        ),
    },
    'luxury-design-ecommerce': {
        // A designer pendant lamp, displayed like the design object it is.
        items: <Model name="pendant" scale={0.42} collider={false} />,
    },
    recognai: {
        items: <Model name="security-camera" scale={0.85} collider={false} />,
    },
    eurocompass: {
        items: (
            <>
                <Model name="suitcase" scale={0.28} rotationY={0.15} collider={false} />
                <Model
                    name="compass"
                    scale={1.9}
                    position={[0.02, 0.16, 0.01]}
                    rotationY={-0.6}
                    collider={false}
                />
            </>
        ),
    },
    pasionis: {
        // A barber's chair in miniature, turned three-quarters toward you.
        items: <Model name="barber-chair" scale={0.3} rotationY={0.5} collider={false} />,
    },
};

/** The featured project's podium display: a tyre turning slowly, its pump beside the plinth. */
export function FeaturedDisplay({ top, base }: { top: number; base: number }) {
    return (
        <>
            <Turntable y={top}>
                <Model name="tyre" collider={false} />
            </Turntable>
            <Model
                name="tyre-pump"
                position={[0.62, base, 0.6]}
                rotationY={-0.6}
                collider={false}
            />
        </>
    );
}

/** Spins its contents slowly about y, like a display turntable. */
function Turntable({ y, children }: { y: number; children: ReactNode }) {
    const group = useRef<Group>(null);
    useFrame((_, delta) => {
        if (group.current) group.current.rotation.y += Math.min(delta, 0.1) * 0.35;
    });
    return (
        <group ref={group} position-y={y}>
            {children}
        </group>
    );
}

/**
 * A glass display case: a clear box with a thin black steel frame, sitting
 * on the plinth (y = 0 is the plinth's top).
 *
 * The glass is a plain transparent material, not three.js' physically based
 * "transmission" glass: that one refracts properly, but needs an extra render
 * of the whole scene behind it every frame. At this size, a faint tint and
 * the environment's reflections read as glass just as well.
 */
export function Vitrine() {
    const s = CASE.size;
    const h = CASE.height;
    const bar = 0.012;
    const edges: [number, number][] = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
    ];
    return (
        <group>
            <mesh position-y={h / 2} renderOrder={1}>
                <boxGeometry args={[s, h, s]} />
                <meshStandardMaterial
                    color="#dfe8ee"
                    transparent
                    opacity={0.1}
                    roughness={0.04}
                    metalness={0}
                    envMapIntensity={1.6}
                    depthWrite={false}
                />
            </mesh>
            {/* frame: four uprights, and rails around the top */}
            {edges.map(([sx, sz]) => (
                <Block
                    key={`${sx},${sz}`}
                    size={[bar, h, bar]}
                    position={[(sx * s) / 2, h / 2, (sz * s) / 2]}
                    surface="metal"
                />
            ))}
            <Block size={[s + bar, bar, bar]} position={[0, h, s / 2]} surface="metal" />
            <Block size={[s + bar, bar, bar]} position={[0, h, -s / 2]} surface="metal" />
            <Block size={[bar, bar, s + bar]} position={[s / 2, h, 0]} surface="metal" />
            <Block size={[bar, bar, s + bar]} position={[-s / 2, h, 0]} surface="metal" />
        </group>
    );
}

/**
 * The plaque on the wall behind an exhibit: year, title, what it is and what
 * it was built with, as a museum would hang it. Drawn once into a canvas
 * (after the web fonts have loaded, or it would bake in a fallback font).
 */
export function Plaque({
    project,
    position,
}: {
    project: Project;
    position: [number, number, number];
}) {
    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
        let alive = true;
        document.fonts.ready.then(() => alive && setFontsReady(true));
        return () => {
            alive = false;
        };
    }, []);
    const texture = useMemo(() => (fontsReady ? drawPlaque(project) : null), [project, fontsReady]);
    useEffect(() => () => texture?.dispose(), [texture]);

    // Not until the print exists: a material compiled without a texture doesn't
    // pick one up later on its own (three.js would need telling to recompile).
    if (!texture) return null;
    return (
        <mesh position={position}>
            <boxGeometry args={[PLAQUE.width, PLAQUE.height, 0.03]} />
            <meshStandardMaterial attach="material-0" color="#141312" />
            <meshStandardMaterial attach="material-1" color="#141312" />
            <meshStandardMaterial attach="material-2" color="#141312" />
            <meshStandardMaterial attach="material-3" color="#141312" />
            {/* the front face carries the print; a little self-light keeps it readable in a dim room */}
            <meshStandardMaterial
                attach="material-4"
                map={texture}
                emissive="#ffffff"
                emissiveMap={texture}
                emissiveIntensity={0.35}
                roughness={0.7}
            />
            <meshStandardMaterial attach="material-5" color="#141312" />
        </mesh>
    );
}

const PLAQUE = { width: 1.5, height: 1.0 };

function drawPlaque(project: Project) {
    const css = getComputedStyle(document.documentElement);
    const display = css.getPropertyValue('--font-archivo').trim() || 'system-ui, sans-serif';
    const sans = css.getPropertyValue('--font-inter').trim() || 'system-ui, sans-serif';
    const mono = css.getPropertyValue('--font-plex-mono').trim() || 'ui-monospace, monospace';
    const W = 1200;
    const H = Math.round((W * PLAQUE.height) / PLAQUE.width);
    const pad = 70;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;

    g.fillStyle = '#171614';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e0a56a';
    g.fillRect(pad, pad, 60, 6); // a short accent rule

    g.textBaseline = 'alphabetic';
    g.fillStyle = '#e0a56a';
    g.font = `500 30px ${mono}`;
    g.fillText(`${project.year}${project.featured ? '  ·  FEATURED' : ''}`, pad, pad + 64);

    // The title, shrunk to fit one line.
    g.fillStyle = '#ece8e2';
    let size = 76;
    g.font = `800 ${size}px ${display}`;
    while (g.measureText(project.title).width > W - pad * 2 && size > 40) {
        size -= 2;
        g.font = `800 ${size}px ${display}`;
    }
    g.fillText(project.title, pad, pad + 64 + 24 + size);

    // The summary, wrapped; long ones are cut off with an ellipsis at five lines.
    g.fillStyle = '#c9c3ba';
    g.font = `400 32px ${sans}`;
    const lines = wrap(g, project.summary, W - pad * 2, 5);
    let y = pad + 64 + 24 + size + 64;
    for (const line of lines) {
        g.fillText(line, pad, y);
        y += 46;
    }

    // Tags along the bottom.
    g.font = `500 24px ${mono}`;
    let x = pad;
    const ty = H - pad - 8;
    for (const tag of project.skills.slice(0, 8).map(skillName)) {
        const w = g.measureText(tag).width + 28;
        if (x + w > W - pad) break;
        g.fillStyle = 'rgba(236,232,226,0.1)';
        roundRect(g, x, ty - 34, w, 46, 8);
        g.fillStyle = '#a39d94';
        g.fillText(tag, x + 14, ty - 3);
        x += w + 12;
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number) {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width > width && line) {
            lines.push(line);
            line = word;
            if (lines.length === max) break;
        } else {
            line = next;
        }
    }
    if (lines.length < max && line) lines.push(line);
    if (lines.length === max && lines.join(' ').length < text.length) {
        let last = lines[max - 1];
        while (g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
        lines[max - 1] = `${last.trimEnd()}…`;
    }
    return lines;
}

function roundRect(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
}

/**
 * Knowledge Loft's exhibit is the loft itself, as an architect's model: the
 * real floor plan (from the same layouts the rooms are built from) at 1:90,
 * floors in pale wood and walls in white card, open to look into.
 */
const MINI = 1 / 90;
function MiniLoft() {
    const career = roomFor(companies.length);
    const T = LOBBY.wall;
    const rooms = [
        { x0: -LOBBY.halfWidth, x1: LOBBY.halfWidth, z0: -LOBBY.halfDepth, z1: LOBBY.halfDepth },
        { x0: PROJECTS.x0, x1: PROJECTS.x1, z0: PROJECTS.z0, z1: PROJECTS.z1 },
        { x0: HOBBIES.x0, x1: HOBBIES.x1, z0: HOBBIES.z0, z1: HOBBIES.z1 },
        { x0: career.x0, x1: career.x1, z0: career.z0, z1: career.z1 },
    ];
    const minX = Math.min(...rooms.map((r) => r.x0)) - T;
    const maxX = Math.max(...rooms.map((r) => r.x1)) + T;
    const minZ = Math.min(...rooms.map((r) => r.z0)) - T;
    const maxZ = Math.max(...rooms.map((r) => r.z1)) + T;
    // Centred on the case floor. Inside the scaled group, sizes are the real
    // loft's metres: 1.2 m of base board comes out at 1.3 cm.
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const h = LOBBY.height;

    return (
        <group scale={MINI} position={[0, 0.013, 0]}>
            {/* the model's base board */}
            <mesh position={[0, -0.6, 0]}>
                <boxGeometry args={[maxX - minX + 1.5, 1.2, maxZ - minZ + 1.5]} />
                <meshStandardMaterial color="#1d1e21" roughness={0.6} />
            </mesh>
            <group position={[-cx, 0, -cz]}>
                {rooms.map((r) => {
                    const w = r.x1 - r.x0;
                    const d = r.z1 - r.z0;
                    const mx = (r.x0 + r.x1) / 2;
                    const mz = (r.z0 + r.z1) / 2;
                    const card = '#f1ece4';
                    return (
                        <group key={`${r.x0},${r.z0}`}>
                            <mesh position={[mx, 0.1, mz]}>
                                <boxGeometry args={[w, 0.2, d]} />
                                <meshStandardMaterial color="#c9a477" roughness={0.7} />
                            </mesh>
                            {[
                                [mx, r.z0 - T / 2, w + T * 2, T],
                                [mx, r.z1 + T / 2, w + T * 2, T],
                            ].map(([x, z, sx, sz]) => (
                                <mesh key={`${x},${z}`} position={[x, h / 2, z]}>
                                    <boxGeometry args={[sx, h, sz]} />
                                    <meshStandardMaterial color={card} roughness={0.9} />
                                </mesh>
                            ))}
                            {[
                                [r.x0 - T / 2, mz, T, d],
                                [r.x1 + T / 2, mz, T, d],
                            ].map(([x, z, sx, sz]) => (
                                <mesh key={`${x},${z}`} position={[x, h / 2, z]}>
                                    <boxGeometry args={[sx, h, sz]} />
                                    <meshStandardMaterial color={card} roughness={0.9} />
                                </mesh>
                            ))}
                        </group>
                    );
                })}
            </group>
        </group>
    );
}
