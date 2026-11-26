'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, Matrix4, SRGBColorSpace, type InstancedMesh } from 'three';
import { useWorld } from '@/store/world';
import { Block } from '@/world/greybox/Block';
import { Label } from '@/world/greybox/Label';
import { Interactable, useIsFocused } from '@/world/interaction/Interactable';
import { contributionLevels, timeAgo, type GithubData, type GithubRepo } from './types';

/**
 * The GitHub wall: live data on the far wall of the Projects gallery.
 *
 * - The contribution calendar (a year, one cell per day) as an LED relief:
 *   busier days glow brighter and stand further out from the wall. All 371
 *   cells are one InstancedMesh, so one draw call.
 * - Below it, your latest public repos as cards (canvas textures, like the
 *   labels), each one inspectable.
 *
 * Data comes from /api/github via the store (see ui/github.tsx), so the
 * wall updates itself when the hourly refresh brings something new.
 *
 * Built in the wall's own frame: x to the right as you face it, y up,
 * z out of the wall. The parent rotates it onto the gallery's west wall.
 */

const PITCH = 0.11; // metres from one cell to the next
const CELL = 0.09;
const MAX_CELLS = 54 * 7;
const CAL_Y = 2.55; // middle of the calendar
const CARD_Y = 1.3;
const CARD_W = 1.3;
const CARD_H = 0.78;
const CARD_GAP = 0.18;

// GitHub's dark-theme greens per level; the top levels go above 1.0 so bloom makes them glow.
const LEVEL_COLOR = ['#1e242c', '#0e4429', '#006d32', '#26a641', '#39d353'].map(
    (c) => new Color(c),
);
const LEVEL_BRIGHTNESS = [1, 1.1, 1.25, 1.45, 1.9];
const LEVEL_DEPTH = [0.012, 0.03, 0.05, 0.075, 0.1];

// Render-loop scratch (module scope: the loop mutates it, React never does).
const matrix = new Matrix4();
const tint = new Color();
const anim = { rise: 0, layout: null as Cell[] | null };
const cellColors = new Float32Array(MAX_CELLS * 3); // created once: a new array each render would rebuild the attribute

type Cell = { x: number; y: number; level: number; today: boolean };

/** Calendar days to cell positions: one column per week, Sunday on top, like GitHub. */
function layoutCalendar(calendar: NonNullable<GithubData['calendar']>): Cell[] {
    const levels = contributionLevels(calendar.days);
    const first = new Date(`${calendar.days[0]?.date}T00:00:00Z`).getUTCDay();
    const weeks = Math.ceil((calendar.days.length + first) / 7);
    const width = weeks * PITCH;
    return calendar.days.map((d, i) => {
        const slot = i + first;
        return {
            x: -width / 2 + (Math.floor(slot / 7) + 0.5) * PITCH,
            y: CAL_Y + 3 * PITCH - (slot % 7) * PITCH,
            level: levels[i],
            today: i === calendar.days.length - 1,
        };
    });
}

export function GithubWall({
    position,
    rotationY,
}: {
    position: [number, number, number];
    rotationY: number;
}) {
    const github = useWorld((s) => s.github);
    const cellsMesh = useRef<InstancedMesh>(null);
    const cells = useMemo(
        () => (github?.calendar ? layoutCalendar(github.calendar) : null),
        [github],
    );

    // New data: the cells rise out of the wall again.
    useEffect(() => {
        anim.layout = cells;
        anim.rise = 0;
    }, [cells]);

    useFrame(({ clock }, delta) => {
        const mesh = cellsMesh.current;
        const layout = anim.layout;
        if (!mesh || !layout) return;
        anim.rise = Math.min(1, anim.rise + delta * 0.8);
        const rise = 1 - (1 - anim.rise) ** 3; // ease out: fast, then settling
        const focused = useWorld.getState().focused?.id === 'github:calendar';
        const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3);

        layout.forEach((c, i) => {
            const depth = LEVEL_DEPTH[c.level] * (0.15 + 0.85 * rise);
            matrix.makeScale(CELL, CELL, depth).setPosition(c.x, c.y, depth / 2);
            mesh.setMatrixAt(i, matrix);
            const glow =
                LEVEL_BRIGHTNESS[c.level] * (focused ? 1.35 : 1) * (c.today ? 1 + pulse : 1);
            mesh.setColorAt(i, tint.copy(LEVEL_COLOR[c.today ? 4 : c.level]).multiplyScalar(glow));
        });
        mesh.count = layout.length;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const repos = github?.repos ?? [];
    const subtitle = !github
        ? 'Connecting…'
        : github.calendar
          ? `@${github.login} · ${github.calendar.total.toLocaleString('en')} contributions in the last year`
          : `@${github.login} · latest repositories`;
    const rowWidth = repos.length * CARD_W + Math.max(0, repos.length - 1) * CARD_GAP;

    return (
        <group position={position} rotation-y={rotationY}>
            <Label title="GitHub" subtitle={subtitle} width={2.8} position={[0, 3.45, 0.02]} />

            {cells && (
                <Interactable
                    id="github:calendar"
                    label={`Contributions · ${github?.calendar?.total ?? 0} in the last year`}
                    action={{ kind: 'panel', panel: { kind: 'github' } }}
                >
                    {/* invisible hit area over the whole calendar */}
                    <mesh visible={false} position={[0, CAL_Y, 0.05]}>
                        <boxGeometry args={[54 * PITCH, 7 * PITCH, 0.1]} />
                    </mesh>
                </Interactable>
            )}
            <instancedMesh
                ref={cellsMesh}
                args={[undefined, undefined, MAX_CELLS]}
                count={0}
                frustumCulled={false}
            >
                <instancedBufferAttribute attach="instanceColor" args={[cellColors, 3]} />
                <boxGeometry />
                <meshBasicMaterial />
            </instancedMesh>

            {repos.map((repo, i) => (
                <Interactable
                    key={repo.name}
                    id={`repo:${repo.name}`}
                    label={`${repo.name} · Repository`}
                    action={{ kind: 'panel', panel: { kind: 'repo', name: repo.name } }}
                >
                    <RepoCard
                        repo={repo}
                        x={-rowWidth / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP)}
                    />
                </Interactable>
            ))}
        </group>
    );
}

function RepoCard({ repo, x }: { repo: GithubRepo; x: number }) {
    const focused = useIsFocused();
    const texture = useMemo(() => drawCard(repo), [repo]);
    useEffect(() => () => texture.dispose(), [texture]);
    return (
        <group position={[x, CARD_Y, 0]}>
            {/* a thin steel frame behind the screen */}
            <Block
                size={[CARD_W + 0.05, CARD_H + 0.05, 0.03]}
                position={[0, 0, 0.015]}
                surface="metal"
            />
            <mesh position={[0, 0, 0.032]}>
                <planeGeometry args={[CARD_W, CARD_H]} />
                {/* Unlit, like a screen; brighter while you look at it. */}
                <meshBasicMaterial map={texture} color={focused ? [1.35, 1.35, 1.35] : [1, 1, 1]} />
            </mesh>
        </group>
    );
}

/** A repo card, drawn like a GitHub dark-mode card. */
function drawCard(repo: GithubRepo) {
    const W = 1040;
    const H = Math.round((W * CARD_H) / CARD_W);
    const css = getComputedStyle(document.documentElement);
    const font = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
    const display = font('--font-archivo', 'system-ui, sans-serif');
    const sans = font('--font-inter', 'system-ui, sans-serif');
    const mono = font('--font-plex-mono', 'ui-monospace, monospace');

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#0d1117';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#30363d';
    g.lineWidth = 6;
    g.strokeRect(3, 3, W - 6, H - 6);

    const pad = 56;
    g.textBaseline = 'top';
    g.fillStyle = '#58a6ff';
    g.font = `700 84px ${display}`;
    g.fillText(repo.name, pad, pad, W - pad * 2);

    g.fillStyle = '#c9d1d9';
    g.font = `400 50px ${sans}`;
    if (repo.description) {
        wrap(g, repo.description, W - pad * 2, 3).forEach((line, i) =>
            g.fillText(line, pad, pad + 124 + i * 64),
        );
    }

    // Bottom row: language, stars, last push.
    let x = pad;
    const y = H - pad - 42;
    g.font = `500 42px ${mono}`;
    if (repo.language) {
        g.fillStyle = repo.languageColor ?? '#8b949e';
        g.beginPath();
        g.arc(x + 17, y + 21, 17, 0, Math.PI * 2);
        g.fill();
        x += 48;
        g.fillStyle = '#8b949e';
        g.fillText(repo.language, x, y);
        x += g.measureText(repo.language).width + 40;
    }
    g.fillStyle = '#8b949e';
    if (repo.stars > 0) {
        const stars = `★ ${repo.stars}`;
        g.fillText(stars, x, y);
        x += g.measureText(stars).width + 40;
    }
    g.fillText(`updated ${timeAgo(repo.pushedAt)}`, x, y);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

/** Break text into at most `max` lines that fit `width`, ending with "…" if cut. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number) {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width <= width) {
            line = next;
            continue;
        }
        if (line) lines.push(line);
        line = word;
        if (lines.length === max) break;
    }
    if (lines.length < max && line) lines.push(line);
    if (lines.length === max && lines.join(' ').length < text.length) {
        let last = lines[max - 1];
        while (g.measureText(`${last}…`).width > width && last.length > 0) last = last.slice(0, -1);
        lines[max - 1] = `${last}…`;
    }
    return lines;
}
