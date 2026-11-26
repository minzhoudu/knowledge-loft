'use client';

import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { currently, CURRENTLY_KINDS } from '@/content';
import { useWorld } from '@/store/world';
import { Block } from '@/world/greybox/Block';
import { Interactable, useIsFocused } from '@/world/interaction/Interactable';
import { timeAgo, type GithubRepo } from '@/world/github/types';

/**
 * The "currently" board: a felt letter board in the lobby, the kind with
 * white push-in letters, listing what you're building, learning, reading...
 *
 * Content comes from `currently` in data.ts. A line with a `repo` also gets
 * a live note ("pushed 2 hours ago") from the GitHub data the wall already
 * fetches, so the board shows real activity without you touching it.
 *
 * Built in the board's own frame (x right, y up, z out of the wall).
 */

const W = 1.7; // metres
const H = 1.15;
const FRAME = 0.06;
const PX_PER_M = 800; // canvas resolution: crisp letters from a couple of metres

export function CurrentlyBoard({
    position,
    rotationY,
}: {
    position: [number, number, number];
    rotationY: number;
}) {
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id="lobby-currently"
                label="Letter board · Currently"
                action={{ kind: 'panel', panel: { kind: 'section', id: 'currently' } }}
            >
                {/* oak frame */}
                <Block
                    size={[W + FRAME * 2, FRAME, 0.05]}
                    position={[0, H / 2 + FRAME / 2, 0.025]}
                />
                <Block
                    size={[W + FRAME * 2, FRAME, 0.05]}
                    position={[0, -H / 2 - FRAME / 2, 0.025]}
                />
                <Block size={[FRAME, H, 0.05]} position={[-W / 2 - FRAME / 2, 0, 0.025]} />
                <Block size={[FRAME, H, 0.05]} position={[W / 2 + FRAME / 2, 0, 0.025]} />
                <Felt />
            </Interactable>
        </group>
    );
}

function Felt() {
    const focused = useIsFocused();
    // Redraw when the GitHub data arrives or refreshes (for the live "pushed ..." note).
    const repos = useWorld((s) => s.github?.repos);
    const texture = useMemo(() => drawBoard(repos ?? []), [repos]);
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        <mesh position={[0, 0, 0.02]} receiveShadow>
            <planeGeometry args={[W, H]} />
            {/* Felt is matte. A faint self-glow (emissiveMap = the same image)
                keeps the white letters readable when the lobby is dark. */}
            <meshStandardMaterial
                map={texture}
                roughness={0.95}
                emissiveMap={texture}
                emissive="#ffffff"
                emissiveIntensity={focused ? 0.45 : 0.12}
            />
        </mesh>
    );
}

function drawBoard(repos: GithubRepo[]) {
    const css = getComputedStyle(document.documentElement);
    const font = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
    const display = font('--font-archivo', 'system-ui, sans-serif');
    const mono = font('--font-plex-mono', 'ui-monospace, monospace');

    const cw = Math.round(W * PX_PER_M);
    const ch = Math.round(H * PX_PER_M);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext('2d')!;

    // Felt: near-black with fine fibres, and the horizontal grooves the letters slot into.
    g.fillStyle = '#1c1b1d';
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
        g.fillRect(Math.random() * cw, Math.random() * ch, 1, 2 + Math.random() * 3);
    }
    const GROOVE = 46;
    for (let y = GROOVE; y < ch; y += GROOVE) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(0, y, cw, 3);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(0, y + 3, cw, 1);
    }

    const pad = 80;
    const maxW = cw - pad * 2;
    g.textBaseline = 'alphabetic';
    // Plastic letters: off-white, with a small shadow where they stand off the felt.
    const letters = (text: string, size: number, x: number, y: number, color = '#f4f1ea') => {
        let s = size;
        g.font = `800 ${s}px ${display}`;
        g.letterSpacing = `${Math.round(s * 0.08)}px`;
        while (g.measureText(text).width > maxW - (x - pad) && s > 28) {
            s -= 2;
            g.font = `800 ${s}px ${display}`;
            g.letterSpacing = `${Math.round(s * 0.08)}px`;
        }
        g.shadowColor = 'rgba(0,0,0,0.7)';
        g.shadowOffsetY = 3;
        g.shadowBlur = 4;
        g.fillStyle = color;
        g.fillText(text, x, y);
        g.shadowColor = 'transparent';
    };
    const small = (text: string, x: number, y: number, color: string) => {
        g.font = `500 30px ${mono}`;
        g.letterSpacing = '3px';
        g.fillStyle = color;
        g.fillText(text, x, y);
    };

    letters('CURRENTLY', 92, pad, pad + 70, '#e0a56a');

    // One row per item: the kind on top in small type, the title in big letters.
    const rowH = Math.min(150, (ch - pad * 2 - 150) / currently.items.length);
    currently.items.forEach((item, i) => {
        const y = pad + 175 + i * rowH;
        small(CURRENTLY_KINDS[item.kind].toUpperCase(), pad, y, '#a39d94');
        letters(item.title.toUpperCase(), 64, pad, y + 66);
        const repo = item.repo ? repos.find((r) => r.name === item.repo) : undefined;
        if (repo) {
            g.font = `800 64px ${display}`;
            g.letterSpacing = '5px';
            const end = Math.min(
                pad + g.measureText(item.title.toUpperCase()).width + 30,
                cw - 420,
            );
            small(`● pushed ${timeAgo(repo.pushedAt)}`, end, y + 62, '#39d353');
        }
    });

    const updated = new Date(`${currently.updated}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    small(`UPDATED ${updated.toUpperCase()}`, pad, ch - pad + 20, '#6b665e');

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
