import { useId } from 'react';
import { constellation } from '@/world/constellation/layout';
import { SKILL_COLORS } from '@/world/constellation/colors';

/**
 * The skill constellation from the 3D lobby, drawn flat: the same layout
 * (layout.ts runs on the server too, it's plain maths), seen from the front.
 * Plain SVG, so it's sharp at any size and costs no JavaScript.
 */

const { stars, links } = constellation;
// Turned a little so the busiest regions spread across the width.
const TURN = 0.6;
const raw = stars.map((s) => {
    const [x, y, z] = s.position;
    return { x: x * Math.cos(TURN) - z * Math.sin(TURN), y: -y }; // SVG y points down
});
// Fill the frame: stretch the drawing to a 2.2 × 2.4 box (the card is
// portrait on wide screens, landscape on phones; the SVG keeps the aspect
// and centres it).
const xs = raw.map((p) => p.x);
const ys = raw.map((p) => p.y);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const flat = raw.map((p) => ({
    x: ((p.x - x0) / (x1 - x0) - 0.5) * 2.0,
    y: ((p.y - y0) / (y1 - y0) - 0.5) * 2.2,
}));

/**
 * The busiest skills get their names written next to them, unless a name
 * already sits close by: overlapping labels read as noise.
 */
const NAMED = new Set<string>();
const placed: { x: number; y: number }[] = [];
for (const i of stars.map((_, i) => i).sort((a, b) => stars[b].uses - stars[a].uses)) {
    if (NAMED.size >= 10) break;
    const clash = placed.some(
        (p) => Math.abs(p.x - flat[i].x) < 0.42 && Math.abs(p.y - flat[i].y) < 0.12,
    );
    if (clash) continue;
    NAMED.add(stars[i].slug);
    placed.push(flat[i]);
}

export function SkyArt() {
    // Drawn twice on the page: each copy needs its own filter id.
    const glow = useId();
    return (
        <svg
            viewBox="-1.2 -1.3 2.6 2.6"
            className="h-full w-full"
            role="img"
            aria-label="A constellation of skills: each star is a skill, linked to the skills it was used with."
        >
            <defs>
                <filter id={glow} x="-1" y="-1" width="3" height="3">
                    <feGaussianBlur stdDeviation="0.018" />
                </filter>
            </defs>
            <g strokeWidth="0.004">
                {links.map(({ a, b, weight }) => (
                    <line
                        key={`${a}-${b}`}
                        x1={flat[a].x}
                        y1={flat[a].y}
                        x2={flat[b].x}
                        y2={flat[b].y}
                        stroke={SKILL_COLORS[stars[a].category]}
                        strokeOpacity={Math.min(0.5, 0.1 + weight * 0.08)}
                    />
                ))}
            </g>
            {stars.map((s, i) => {
                const r = 0.018 + 0.01 * Math.sqrt(s.uses);
                const color = SKILL_COLORS[s.category];
                return (
                    <g
                        key={s.slug}
                        className={i % 3 === 0 ? 'twinkle' : undefined}
                        style={{ animationDelay: `${(i * 0.37) % 3}s` }}
                    >
                        <circle
                            cx={flat[i].x}
                            cy={flat[i].y}
                            r={r * 2.2}
                            fill={color}
                            opacity={0.35}
                            filter={`url(#${glow})`}
                        />
                        <circle cx={flat[i].x} cy={flat[i].y} r={r} fill={color} />
                    </g>
                );
            })}
            {stars.map((s, i) =>
                NAMED.has(s.slug) ? (
                    <text
                        key={s.slug}
                        x={flat[i].x + 0.05}
                        y={flat[i].y + 0.022}
                        fontSize="0.065"
                        fill="#ece8e2"
                        fillOpacity={0.85}
                        className="font-mono"
                    >
                        {s.name}
                    </text>
                ) : null,
            )}
        </svg>
    );
}
