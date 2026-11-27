'use client';

import { Block } from '@/world/greybox/Block';
import { GROUND_Y, ROOF_Y, SHELL, SOUTH_WINDOWS } from './layout';

/**
 * The loft's outside: a brick skin over every outer wall, with openings for
 * the windows, and a steel coping along the top.
 *
 * It's a separate thin layer rather than a different material on the room
 * walls, because a wall is one box: its inside and outside faces share a
 * material. Blocks use world-space UVs (see worldBox), so the brick pattern
 * runs on seamlessly across the pieces split around a window.
 */

const SKIN = 0.06; // brick skin thickness

type Opening = { from: number; to: number; y0: number; y1: number };

/** One straight stretch of wall along x (at a fixed z) or along z (at a fixed x). */
function Run({
    along,
    at,
    from,
    to,
    openings = [],
}: {
    along: 'x' | 'z';
    at: number;
    from: number;
    to: number;
    openings?: Opening[];
}) {
    const pieces: { a: number; b: number; y0: number; y1: number }[] = [];
    let cursor = from;
    for (const o of [...openings].sort((p, q) => p.from - q.from)) {
        if (o.from > cursor) pieces.push({ a: cursor, b: o.from, y0: GROUND_Y, y1: ROOF_Y });
        pieces.push({ a: o.from, b: o.to, y0: GROUND_Y, y1: o.y0 }); // below the window
        pieces.push({ a: o.from, b: o.to, y0: o.y1, y1: ROOF_Y }); // above it
        cursor = o.to;
    }
    if (to > cursor) pieces.push({ a: cursor, b: to, y0: GROUND_Y, y1: ROOF_Y });

    const box = (a: number, b: number, y0: number, y1: number, depth: number) => {
        const len = b - a;
        const mid = (a + b) / 2;
        const size: [number, number, number] =
            along === 'x' ? [len, y1 - y0, depth] : [depth, y1 - y0, len];
        const position: [number, number, number] =
            along === 'x' ? [mid, (y0 + y1) / 2, at] : [at, (y0 + y1) / 2, mid];
        return { size, position };
    };

    return (
        <>
            {pieces.map((p) => {
                const { size, position } = box(p.a, p.b, p.y0, p.y1, SKIN);
                return (
                    <Block key={`${p.a},${p.y0}`} size={size} position={position} surface="brick" />
                );
            })}
            {/* coping: a dark steel cap along the top */}
            <Block {...box(from, to, ROOF_Y, ROOF_Y + 0.06, SKIN + 0.08)} surface="metal" />
        </>
    );
}

export function Facade() {
    const s = SHELL;
    const o = SKIN / 2; // skin centre, just outside the wall
    const corner = SKIN; // runs overlap at corners so they close
    return (
        <group>
            {/* street side, with the lobby and lounge windows */}
            <Run
                along="x"
                at={s.south + o}
                from={s.west - corner}
                to={s.east + corner}
                openings={SOUTH_WINDOWS}
            />
            {/* back, either side of the career corridor */}
            <Run along="x" at={s.north - o} from={s.west - corner} to={s.corridorWest} />
            <Run along="x" at={s.north - o} from={s.corridorEast} to={s.east + corner} />
            {/* ends */}
            <Run along="z" at={s.west - o} from={s.north - corner} to={s.south + corner} />
            <Run along="z" at={s.east + o} from={s.north - corner} to={s.south + corner} />
            {/* the career corridor running north */}
            <Run along="z" at={s.corridorWest - o} from={s.corridorNorth - corner} to={s.north} />
            <Run along="z" at={s.corridorEast + o} from={s.corridorNorth - corner} to={s.north} />
            <Run
                along="x"
                at={s.corridorNorth - o}
                from={s.corridorWest - corner}
                to={s.corridorEast + corner}
            />
        </group>
    );
}
