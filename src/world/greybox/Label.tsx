'use client';

import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

type Vec3 = [number, number, number];

type Props = {
    title: string;
    subtitle?: string;
    /** Width of the label in metres; height follows from the text layout. */
    width?: number;
    position: Vec3;
    rotationY?: number;
    /** Lay the label flat on the floor (reads correctly when walking toward -z after rotationY). */
    flat?: boolean;
    tone?: 'dark' | 'light';
};

const PX_W = 1024; // canvas resolution: enough for crisp text at a few metres

/**
 * Text in 3D, drawn onto a canvas and used as a texture on a flat plane.
 *
 * Why not real 3D text? Signs and plaques only need to be readable, and a
 * canvas texture is one quad (2 triangles) per label: cheap, sharp, and it
 * uses the same web fonts as the rest of the site. The tradeoff: it's a
 * bitmap, so it blurs if you walk right up to it. Fine for signage.
 */
export function Label({
    title,
    subtitle,
    width = 1.4,
    position,
    rotationY = 0,
    flat = false,
    tone = 'dark',
}: Props) {
    // Canvas text is drawn once, so wait for the web fonts or it would bake in a fallback font.
    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
        let alive = true;
        document.fonts.ready.then(() => alive && setFontsReady(true));
        return () => {
            alive = false;
        };
    }, []);

    const label = useMemo(
        () => (fontsReady ? drawLabel(title, subtitle, tone) : null),
        [title, subtitle, tone, fontsReady],
    );
    // Textures live in GPU memory, which JavaScript's garbage collector can't see.
    useEffect(() => () => label?.texture.dispose(), [label]);

    if (!label) return null;
    const { texture, aspect } = label;
    return (
        // Euler order 'YXZ': turn to face rotationY first, then tip back onto the floor.
        <mesh position={position} rotation={[flat ? -Math.PI / 2 : 0, rotationY, 0, 'YXZ']}>
            <planeGeometry args={[width, width / aspect]} />
            <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
    );
}

function cssFont(variable: string, fallback: string) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return v || fallback;
}

function drawLabel(title: string, subtitle: string | undefined, tone: 'dark' | 'light') {
    const display = cssFont('--font-archivo', 'system-ui, sans-serif');
    const mono = cssFont('--font-plex-mono', 'ui-monospace, monospace');
    const pxH = subtitle ? 340 : 240;

    const canvas = document.createElement('canvas');
    canvas.width = PX_W;
    canvas.height = pxH;
    const g = canvas.getContext('2d')!;

    const bg = tone === 'dark' ? '#1c1b19' : '#f4f1ec';
    const fg = tone === 'dark' ? '#efe9e1' : '#1c1b19';
    const muted = tone === 'dark' ? '#e0a56a' : '#8a5a2b';

    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, PX_W, pxH, 28);
    g.fill();

    const pad = 64;
    const maxW = PX_W - pad * 2;
    g.textBaseline = 'middle';

    // Shrink the title until it fits on one line.
    let size = 120;
    g.font = `700 ${size}px ${display}`;
    while (g.measureText(title).width > maxW && size > 48) {
        size -= 4;
        g.font = `700 ${size}px ${display}`;
    }
    g.fillStyle = fg;
    g.fillText(title, pad, subtitle ? pxH * 0.4 : pxH / 2, maxW);

    if (subtitle) {
        // Same for the subtitle (long job titles), before fillText's maxWidth squashes it.
        const text = subtitle.toUpperCase();
        let sub = 52;
        g.font = `500 ${sub}px ${mono}`;
        while (g.measureText(text).width > maxW && sub > 30) {
            sub -= 2;
            g.font = `500 ${sub}px ${mono}`;
        }
        g.fillStyle = muted;
        g.fillText(text, pad, pxH * 0.76, maxW);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace; // the canvas holds sRGB colours, like any image
    texture.anisotropy = 4; // keeps text sharp when seen at an angle
    return { texture, aspect: PX_W / pxH };
}
