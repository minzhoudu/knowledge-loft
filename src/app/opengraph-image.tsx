import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { about } from '@/content';
import { SKILL_COLORS } from '@/world/constellation/colors';
import { constellation } from '@/world/constellation/layout';
import { SHARE_ALT } from './share';

/**
 * The link-preview image: what LinkedIn, Slack, iMessage or email show when
 * someone shares the site. Next.js draws it once at build time from this
 * JSX (with next/og, which turns HTML and CSS into a PNG) and adds the
 * og:image tags to every page.
 *
 * It's the site in one glance: the name, the role, and the skill
 * constellation from the lobby, drawn flat in the same colours.
 */

export const alt = SHARE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Read once, when the module loads at build time. Reading them inside the
// image function would count as fetching fresh data on every request, and
// Next.js would then draw the image per request instead of once.
const font = (file: string) => readFile(join(process.cwd(), 'src/app/og-fonts', file));
const [archivo, mono, inter] = await Promise.all([
    font('archivo-800.ttf'),
    font('plex-mono-500.ttf'),
    font('inter-400.ttf'),
]);

/** The constellation seen from the front, fitted into a w×h box (as on the quick view). */
function sky(w: number, h: number) {
    const { stars, links } = constellation;
    const raw = stars.map((s) => ({ x: s.position[0], y: -s.position[1] }));
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 30;
    const at = raw.map((p) => ({
        x: pad + ((p.x - x0) / (x1 - x0)) * (w - pad * 2),
        y: pad + ((p.y - y0) / (y1 - y0)) * (h - pad * 2),
    }));
    return { stars, links, at };
}

export default async function OpengraphImage() {
    const W = 430;
    const H = 470;
    const { stars, links, at } = sky(W, H);

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 70px',
                background:
                    'radial-gradient(circle at 15% 0%, #3a2616 0%, #141312 55%, #0f0e0d 100%)',
                color: '#ece8e2',
                fontFamily: 'Inter',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', width: 610 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontFamily: 'Plex Mono',
                        fontSize: 22,
                        letterSpacing: 4,
                        color: '#a39d94',
                    }}
                >
                    <div
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            background: '#e0a56a',
                            marginRight: 14,
                        }}
                    />
                    {`STUDIO LOFT · ${(about.location ?? '').toUpperCase()}`}
                </div>
                <div
                    style={{
                        fontFamily: 'Archivo',
                        fontSize: 82,
                        lineHeight: 1,
                        marginTop: 26,
                        letterSpacing: -2,
                    }}
                >
                    {about.name}
                </div>
                <div style={{ fontSize: 31, color: '#e0a56a', marginTop: 22 }}>
                    {about.headline}
                </div>
                <div style={{ fontSize: 24, color: '#a39d94', marginTop: 34, lineHeight: 1.4 }}>
                    Walk through my portfolio as a 3D studio loft, or read the one-page quick view.
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    width: W,
                    height: H,
                    borderRadius: 32,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'radial-gradient(circle at 50% 0%, #1f2236 0%, #0b0c12 75%)',
                }}
            >
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                    {links.map(({ a, b, weight }) => (
                        <line
                            key={`${a}-${b}`}
                            x1={at[a].x}
                            y1={at[a].y}
                            x2={at[b].x}
                            y2={at[b].y}
                            stroke={SKILL_COLORS[stars[a].category]}
                            strokeOpacity={Math.min(0.5, 0.1 + weight * 0.08)}
                            strokeWidth={1.4}
                        />
                    ))}
                    {stars.map((s, i) => {
                        const r = 4 + 2.2 * Math.sqrt(s.uses);
                        const color = SKILL_COLORS[s.category];
                        return (
                            <g key={s.slug}>
                                <circle
                                    cx={at[i].x}
                                    cy={at[i].y}
                                    r={r * 2.4}
                                    fill={color}
                                    opacity={0.18}
                                />
                                <circle cx={at[i].x} cy={at[i].y} r={r} fill={color} />
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>,
        {
            ...size,
            fonts: [
                { name: 'Archivo', data: archivo, weight: 800, style: 'normal' },
                { name: 'Plex Mono', data: mono, weight: 500, style: 'normal' },
                { name: 'Inter', data: inter, weight: 400, style: 'normal' },
            ],
        },
    );
}
