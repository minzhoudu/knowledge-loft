import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { about } from '@/content';

/**
 * The site's mark: the initials on a warm square, the same badge as the
 * quick view's header. Drawn with next/og in the site's display font, once
 * at build time, for the browser tab (icon.tsx) and the iPhone home screen
 * (apple-icon.tsx).
 *
 * Read at module load, like the preview image's fonts: reading inside the
 * image function would count as fresh data and make it render per request.
 */
const archivo = await readFile(join(process.cwd(), 'src/app/og-fonts', 'archivo-800.ttf'));

const initials = about.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

/**
 * `rounded`: a browser tab shows the square as is, so it gets its own rounded
 * corners; iOS masks home-screen icons into its own rounded shape, so there
 * it fills the whole square.
 */
export function brandMark(size: number, rounded: boolean) {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e0a56a',
                borderRadius: rounded ? size * 0.22 : 0,
                color: '#141312',
                fontFamily: 'Archivo',
                fontSize: size * 0.5,
                letterSpacing: -size * 0.02,
                // optical centring: capitals sit a touch high in their line box
                paddingTop: size * 0.03,
            }}
        >
            {initials}
        </div>,
        {
            width: size,
            height: size,
            fonts: [{ name: 'Archivo', data: archivo, weight: 800, style: 'normal' }],
        },
    );
}
