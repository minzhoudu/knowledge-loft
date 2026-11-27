'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    BoxGeometry,
    BufferAttribute,
    CanvasTexture,
    Color,
    RepeatWrapping,
    SRGBColorSpace,
    type MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep } from '@/world/environment/sun';
import { environment } from '@/world/environment/time';
import { CITY_FRONT, GROUND_Y, SHELL, STREET } from './layout';

/**
 * The city around the loft: the row of buildings across the street, the
 * neighbours on either side, and a skyline further out that fades into the
 * fog. What you see through the windows, and what frames the map view.
 *
 * Every building is a box, and all of them are merged into one geometry
 * with one material: the whole city is a single draw call. What makes the
 * boxes read as buildings is the texture:
 * - one window grid (a bay 3 m wide, a storey 3.3 m tall) repeated over
 *   every wall, with UVs in metres so windows keep their size on any box;
 * - a per-building plaster colour, stored per vertex (vertexColors) and
 *   multiplied with the texture, so one texture serves every façade;
 * - a second image with some windows lit, used as the emissive map, which
 *   fades in at dusk: offices and flats lighting up.
 */

const BAY = 3;
const STOREY = 3.3;
const CELLS = 8; // the texture holds 8 x 8 windows, so the lit pattern repeats rarely
const CELL_PX = 128;

const TINTS = [
    '#ddd5c8',
    '#cbbba6',
    '#e7e2d9',
    '#bcab9c',
    '#d6c6b2',
    '#adadaa',
    '#c9a78e',
    '#e9dcc7',
];

/** A seeded random generator (mulberry32): the same city on every visit. */
function random(seed: number) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Building = { x: number; z: number; w: number; d: number; h: number; tint: string };

function plan(): Building[] {
    const rnd = random(7);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const storeys = (min: number, max: number) =>
        (min + Math.floor(rnd() * (max - min + 1))) * STOREY + 0.6;
    const out: Building[] = [];

    // A street wall: buildings side by side along x, fronts on a line.
    const row = (
        x0: number,
        x1: number,
        front: number,
        depth: number,
        sign: 1 | -1,
        lo: number,
        hi: number,
    ) => {
        let x = x0;
        while (x < x1 - 4) {
            const w = Math.min(x1 - x, 8 + Math.floor(rnd() * 3) * BAY);
            out.push({
                x: x + w / 2,
                z: front + (sign * depth) / 2,
                w,
                d: depth,
                h: storeys(lo, hi),
                tint: pick(TINTS),
            });
            x += w;
        }
    };
    const end = STREET.halfLength;
    row(-end, end, CITY_FRONT, 14, 1, 3, 7); // across the street
    row(-end, SHELL.west - 3, SHELL.south, 14, -1, 2, 5); // neighbours, our side
    row(SHELL.east + 3, end, SHELL.south, 14, -1, 2, 5);
    // The block behind the loft, leaving a courtyard around the career corridor.
    const back = SHELL.north - 12;
    row(-end, SHELL.corridorWest - 10, back, 16, -1, 3, 6);
    row(SHELL.corridorEast + 10, end, back, 16, -1, 3, 6);

    // The skyline: scattered blocks further out, kept clear of the street and the loft.
    for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 55 + rnd() * 70;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const nearStreet = z > SHELL.south - 16 && z < CITY_FRONT + 22 && Math.abs(x) < end + 4;
        const nearLoft = Math.abs(x) < 35 && z > SHELL.corridorNorth - 18 && z < SHELL.south;
        if (nearStreet || nearLoft) continue;
        const w = 12 + rnd() * 14;
        out.push({ x, z, w, d: 12 + rnd() * 14, h: storeys(5, 14), tint: pick(TINTS) });
    }
    return out;
}

/** World-space UVs in metres, like worldBox: walls from the side, roofs on a plain patch. */
function buildingGeometry(b: Building) {
    const g = new BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x, GROUND_Y + b.h / 2, b.z);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const tint = new Color(b.tint);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) - GROUND_Y;
        if (Math.abs(nor.getY(i)) > 0.5)
            uv.setXY(i, 0.3, 0.3); // roof: plain wall colour
        else if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, pos.getZ(i), y);
        else uv.setXY(i, pos.getX(i), y);
        colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
}

/** The window grid (colour) and which windows are lit (emissive). */
function drawFacade() {
    const size = CELLS * CELL_PX;
    const make = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return [c, c.getContext('2d')!] as const;
    };
    const [wallC, wall] = make();
    const [litC, lit] = make();
    const rnd = random(11);

    wall.fillStyle = '#ffffff'; // tinted per building by its vertex colour
    wall.fillRect(0, 0, size, size);
    lit.fillStyle = '#000000';
    lit.fillRect(0, 0, size, size);

    const warm = ['#ffd9a0', '#ffe8c2', '#ffcf8a', '#cfe0ff'];
    for (let cy = 0; cy < CELLS; cy++) {
        for (let cx = 0; cx < CELLS; cx++) {
            const x = cx * CELL_PX;
            const y = cy * CELL_PX;
            // window: a dark glass rectangle in a lighter frame, with a sill
            const wx = x + CELL_PX * 0.2;
            const wy = y + CELL_PX * 0.2;
            const ww = CELL_PX * 0.6;
            const wh = CELL_PX * 0.55;
            wall.fillStyle = '#8d8a85';
            wall.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
            const glass = wall.createLinearGradient(wx, wy, wx + ww, wy + wh);
            glass.addColorStop(0, '#3a4654');
            glass.addColorStop(1, '#1f262e');
            wall.fillStyle = glass;
            wall.fillRect(wx, wy, ww, wh);
            wall.fillStyle = '#6d6a66';
            wall.fillRect(wx - 5, wy + wh + 3, ww + 10, 5);
            if (rnd() < 0.32) {
                lit.fillStyle = warm[Math.floor(rnd() * warm.length)];
                lit.fillRect(wx, wy, ww, wh);
            }
        }
    }
    const texture = (c: HTMLCanvasElement) => {
        const t = new CanvasTexture(c);
        t.colorSpace = SRGBColorSpace;
        t.wrapS = t.wrapT = RepeatWrapping;
        // UVs are metres; one texture covers CELLS bays by CELLS storeys.
        t.repeat.set(1 / (CELLS * BAY), 1 / (CELLS * STOREY));
        t.anisotropy = 8;
        return t;
    };
    return { map: texture(wallC), lit: texture(litC) };
}

/** How bright lit windows get at night (above 1 they bloom softly, see PostEffects). */
const NIGHT_GLOW = 1.05;

export function City() {
    const material = useRef<MeshStandardMaterial>(null);
    const geometry = useMemo(() => mergeGeometries(plan().map(buildingGeometry)), []);
    const { map, lit } = useMemo(() => drawFacade(), []);
    useEffect(
        () => () => {
            geometry.dispose();
            map.dispose();
            lit.dispose();
        },
        [geometry, map, lit],
    );

    useFrame(() => {
        const m = material.current;
        // Windows light up as it gets dark, like the lamps (see Lamp.tsx).
        if (m) m.emissiveIntensity = NIGHT_GLOW * (1 - smoothstep(0.1, 0.45, environment.daylight));
    });

    return (
        <mesh geometry={geometry} receiveShadow>
            <meshStandardMaterial
                ref={material}
                map={map}
                vertexColors
                roughness={0.85}
                emissive="#ffffff"
                emissiveMap={lit}
                emissiveIntensity={0}
            />
        </mesh>
    );
}
