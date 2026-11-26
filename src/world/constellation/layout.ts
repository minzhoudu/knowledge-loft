import { companies, projects, skills, type SkillCategory } from '@/content';

/**
 * Where each star goes. A force-directed layout, computed once:
 *
 * Think of every skill as a ball and every "used together" relation as a
 * spring between two balls. Let them all push each other away (so nothing
 * overlaps), let the springs pull related skills together, and let the
 * system jiggle until it settles. What's left is a shape where related
 * things sit close: React next to Next.js and TypeScript, Python near the AI
 * cluster, ecommerce off on its own. Nobody placed anything by hand, so a
 * new project reshapes the sky by itself.
 *
 * One extra, gentle force pulls each skill toward its category's home
 * direction, so colours form loose regions instead of being sprinkled.
 *
 * Runs once at load: ~50 stars × 400 steps is a few milliseconds.
 */

export type Star = {
    slug: string;
    name: string;
    category: SkillCategory;
    /** How many projects and roles list it. */
    uses: number;
    /** Position inside the constellation, roughly within a unit sphere. */
    position: [number, number, number];
};

export type Link = {
    a: number; // index into stars
    b: number;
    /** How many projects and roles use both. */
    weight: number;
};

/** Power applied to each star's distance from the centre; below 1 spreads the core. */
const CORE_STRETCH = 0.55;

const CATEGORY_ORDER: SkillCategory[] = [
    'language',
    'frontend',
    'backend',
    'data',
    'devops',
    'ai',
    'commerce',
];

/**
 * Evenly spread points on a sphere (a Fibonacci spiral): the "home"
 * direction of each category, as far apart from each other as possible.
 */
function homes(count: number) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, i) => {
        const y = 1 - ((i + 0.5) / count) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        return [Math.cos(theta) * r, y * 0.7, Math.sin(theta) * r] as const;
    });
}

/**
 * A tiny seeded random generator (mulberry32). Math.random() would give a
 * different sky on every visit; a fixed seed makes the layout the same every
 * time, for everyone, so the constellation has a recognisable shape.
 */
function seeded(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function build() {
    const index = new Map(skills.map((s, i) => [s.slug, i]));
    const uses = skills.map(() => 0);
    const pairs = new Map<string, Link>();

    for (const item of [...projects, ...companies]) {
        const ids = [...new Set(item.skills)].map((s) => index.get(s)!);
        for (const i of ids) uses[i]++;
        for (let x = 0; x < ids.length; x++) {
            for (let y = x + 1; y < ids.length; y++) {
                const [a, b] = ids[x] < ids[y] ? [ids[x], ids[y]] : [ids[y], ids[x]];
                const key = `${a}:${b}`;
                const link = pairs.get(key) ?? { a, b, weight: 0 };
                link.weight++;
                pairs.set(key, link);
            }
        }
    }
    const links = [...pairs.values()];

    const home = homes(CATEGORY_ORDER.length);
    const random = seeded(7);
    const pos = skills.map((s) => {
        const h = home[CATEGORY_ORDER.indexOf(s.category)];
        return [
            h[0] + (random() - 0.5) * 0.6,
            h[1] + (random() - 0.5) * 0.6,
            h[2] + (random() - 0.5) * 0.6,
        ];
    });

    const STEPS = 400;
    const REPEL = 0.03; // every pair pushes apart, more strongly up close
    const SPRING = 0.02; // linked pairs pull together, stronger the more they're used together
    const REST = 0.5; // a spring's natural length
    const HOME = 0.02; // pull toward the category's home direction
    const CENTRE = 0.01; // keep the whole cloud from drifting off

    for (let step = 0; step < STEPS; step++) {
        const cooling = 1 - step / STEPS; // big moves first, fine settling at the end
        const force = pos.map(() => [0, 0, 0]);

        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                const d = [pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]];
                const dist2 = Math.max(d[0] ** 2 + d[1] ** 2 + d[2] ** 2, 0.01);
                const f = REPEL / dist2; // like charges: inverse square
                for (let k = 0; k < 3; k++) {
                    force[i][k] += d[k] * f;
                    force[j][k] -= d[k] * f;
                }
            }
        }
        for (const { a, b, weight } of links) {
            const d = [pos[b][0] - pos[a][0], pos[b][1] - pos[a][1], pos[b][2] - pos[a][2]];
            const dist = Math.hypot(d[0], d[1], d[2]) || 1e-6;
            const f = (SPRING * Math.sqrt(weight) * (dist - REST)) / dist; // Hooke's law
            for (let k = 0; k < 3; k++) {
                force[a][k] += d[k] * f;
                force[b][k] -= d[k] * f;
            }
        }
        skills.forEach((s, i) => {
            const h = home[CATEGORY_ORDER.indexOf(s.category)];
            for (let k = 0; k < 3; k++)
                force[i][k] += (h[k] - pos[i][k]) * HOME - pos[i][k] * CENTRE;
        });
        for (let i = 0; i < pos.length; i++) {
            for (let k = 0; k < 3; k++)
                pos[i][k] += Math.max(-0.1, Math.min(0.1, force[i][k])) * cooling;
        }
    }

    // Fit the result into a unit sphere, so the size on screen is predictable.
    let radius = Math.max(...pos.map((p) => Math.hypot(p[0], p[1], p[2]))) || 1;
    for (const p of pos) for (let k = 0; k < 3; k++) p[k] /= radius;

    // Busy skills end up crowded in the middle. Two fixes:
    // 1. Stretch distances from the centre with a power below 1 (r^0.55): a
    //    star at 0.2 moves out to 0.41, one at 0.9 barely moves (0.94). The
    //    packed core opens up and the overall shape stays the same.
    for (const p of pos) {
        const r = Math.hypot(p[0], p[1], p[2]) || 1e-6;
        const stretch = Math.pow(r, CORE_STRETCH) / r;
        for (let k = 0; k < 3; k++) p[k] *= stretch;
    }
    // 2. A few rounds of "personal space": any two stars closer than
    //    MIN_GAP get nudged apart, so each one is easy to aim at.
    const MIN_GAP = 0.26;
    for (let round = 0; round < 120; round++) {
        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                const d = [pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]];
                const dist = Math.hypot(d[0], d[1], d[2]) || 1e-6;
                if (dist >= MIN_GAP) continue;
                const push = (MIN_GAP - dist) / 2 / dist;
                for (let k = 0; k < 3; k++) {
                    pos[i][k] += d[k] * push;
                    pos[j][k] -= d[k] * push;
                }
            }
        }
    }
    radius = Math.max(...pos.map((p) => Math.hypot(p[0], p[1], p[2]))) || 1;
    const stars: Star[] = skills.map((s, i) => ({
        slug: s.slug,
        name: s.name,
        category: s.category,
        uses: uses[i],
        position: [pos[i][0] / radius, pos[i][1] / radius, pos[i][2] / radius],
    }));
    return { stars, links };
}

export const constellation = build();

/**
 * For each star, its most-shared neighbours (the 8 with the strongest
 * links): the ones named when you look at it. A busy skill like React links
 * to 30+ others; naming them all would be an unreadable pile of text.
 */
export const strongest = constellation.stars.map((_, i) =>
    constellation.links
        .filter((l) => l.a === i || l.b === i)
        .sort((x, y) => y.weight - x.weight)
        .slice(0, 8)
        .map((l) => (l.a === i ? l.b : l.a)),
);

/** For each star, the indices of the stars it's linked to. */
export const neighbours = constellation.stars.map((_, i) =>
    constellation.links.flatMap((l) => (l.a === i ? [l.b] : l.b === i ? [l.a] : [])),
);
