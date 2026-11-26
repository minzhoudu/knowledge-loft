import { BoxGeometry, CanvasTexture, SRGBColorSpace } from 'three';
import { NOTE_AREAS, NOTE_KINDS, type Note } from '@/content';

/**
 * A book's size and texture, shared by the copy on the shelf and the copy
 * in your hands.
 *
 * Frame on the shelf: x = thickness (front cover at +x), y = height,
 * z = depth with the spine at +z, facing the room.
 */

export type BookSize = { thickness: number; height: number; depth: number };

/** Hardcovers, tall binders and slim notebooks; longer notes are thicker books. */
export function bookSize(note: Note): BookSize {
    // A small, stable "random" per book, so heights vary a little without
    // changing between visits.
    let h = 0;
    for (const c of note.slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const jitter = (h % 1000) / 1000;
    const byLength = Math.min(1, note.words / 350);
    switch (note.kind) {
        case 'case':
            return { thickness: 0.045 + byLength * 0.02, height: 0.3, depth: 0.235 };
        case 'til':
            return { thickness: 0.012 + jitter * 0.006, height: 0.205, depth: 0.148 };
        default:
            return {
                thickness: 0.024 + byLength * 0.022,
                height: 0.232 + jitter * 0.03,
                depth: 0.165,
            };
    }
}

/** How each kind looks: cover colour, spine label style. */
function look(note: Note) {
    const area = NOTE_AREAS[note.area].color;
    switch (note.kind) {
        case 'case': // a dark ring binder with a white label on the spine
            return { cover: '#2a2c30', accent: area, label: true };
        case 'til': // a kraft-paper notebook
            return { cover: '#b39a73', accent: area, label: false };
        default: // a cloth hardcover in the area's colour, gold lettering
            return { cover: area, accent: '#d8b66a', label: false };
    }
}

/**
 * Where each part sits in the book's texture, as u ranges (the full height
 * is always v 0..1). One texture per book holds every face's picture, so
 * the whole book is a single material: one draw call.
 */
type Regions = {
    spine: [number, number];
    front: [number, number];
    back: [number, number];
    pages: [number, number];
};

const PX_PER_M = 2048; // texture pixels per metre of book (height 0.25 m ≈ 512 px)

export function drawBook(note: Note, size: BookSize) {
    const css = getComputedStyle(document.documentElement);
    const serif = 'Georgia, "Times New Roman", serif';
    const mono = css.getPropertyValue('--font-plex-mono').trim() || 'ui-monospace, monospace';
    const { cover, accent, label } = look(note);

    // Each region is as wide (in pixels) as its face is in metres, so text
    // drawn on it isn't stretched when it lands on the box.
    const H = Math.round(size.height * PX_PER_M);
    const spineW = Math.round(size.thickness * PX_PER_M);
    const frontW = Math.round(size.depth * PX_PER_M);
    const backW = 16;
    const pagesW = 64;
    const W = spineW + frontW + backW + pagesW;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;

    // Cover cloth: the colour with faint grain.
    g.fillStyle = cover;
    g.fillRect(0, 0, spineW + frontW + backW, H);
    for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
        g.fillRect(Math.random() * (spineW + frontW + backW), Math.random() * H, 2, 2);
    }

    // Spine: title running top to bottom, as on English-language books.
    g.save();
    if (label) {
        g.fillStyle = '#f1ede4';
        g.fillRect(spineW * 0.12, H * 0.12, spineW * 0.76, H * 0.62);
        g.fillStyle = accent;
        g.fillRect(spineW * 0.12, H * 0.12, spineW * 0.76, H * 0.035);
    } else {
        g.fillStyle = accent;
        g.fillRect(0, H * 0.06, spineW, 3);
        g.fillRect(0, H * 0.94, spineW, 3);
    }
    g.translate(spineW / 2, H * (label ? 0.18 : 0.1));
    g.rotate(Math.PI / 2);
    const maxLen = H * (label ? 0.54 : 0.78);
    let fs = Math.min(spineW * 0.5, 30);
    const font = (s: number) =>
        note.kind === 'note' ? `600 ${s}px ${serif}` : `500 ${s}px ${mono}`;
    g.font = font(fs);
    while (g.measureText(note.title).width > maxLen && fs > 8) g.font = font((fs -= 1));
    g.fillStyle = label ? '#22211f' : note.kind === 'til' ? '#2b2620' : accent;
    g.textBaseline = 'middle';
    g.fillText(note.title, 0, 0);
    g.restore();

    // Front cover: title and kind, for when you hold the book closed.
    const fx = spineW;
    g.fillStyle = accent;
    g.fillRect(fx + frontW * 0.1, H * 0.1, frontW * 0.8, 2);
    g.fillRect(fx + frontW * 0.1, H * 0.9, frontW * 0.8, 2);
    g.fillStyle = note.kind === 'note' ? accent : note.kind === 'til' ? '#2b2620' : '#f1ede4';
    g.font = `600 ${Math.round(frontW * 0.09)}px ${note.kind === 'note' ? serif : mono}`;
    g.textAlign = 'center';
    wrap(
        g,
        note.title.replace(/^(Case|TIL): /, ''),
        fx + frontW / 2,
        H * 0.3,
        frontW * 0.72,
        frontW * 0.11,
    );
    g.font = `500 ${Math.round(frontW * 0.05)}px ${mono}`;
    g.fillText(NOTE_KINDS[note.kind].toUpperCase(), fx + frontW / 2, H * 0.82);

    // Page edges: cream with fine lines.
    const px = spineW + frontW + backW;
    g.fillStyle = '#efe6d2';
    g.fillRect(px, 0, pagesW, H);
    g.fillStyle = 'rgba(120,100,70,0.18)';
    for (let x = px; x < W; x += 3) g.fillRect(x, 0, 1, H);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const u = (a: number, b: number): [number, number] => [a / W, b / W];
    const regions: Regions = {
        spine: u(0, spineW),
        front: u(spineW, spineW + frontW),
        back: u(spineW + frontW, spineW + frontW + backW),
        pages: u(px, W),
    };
    return { texture, regions };
}

function wrap(
    g: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    max: number,
    lh: number,
) {
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width > max && line) {
            g.fillText(line, x, y);
            line = word;
            y += lh;
        } else line = next;
    }
    g.fillText(line, x, y);
}

/**
 * A box whose six faces each show a chosen strip of the book's texture.
 * three.js' BoxGeometry stores its faces in a fixed order (+x, -x, +y, -y,
 * +z, -z), 4 vertices each, with UVs spanning 0..1. We squeeze each face's
 * UVs into its region. `uSlice` picks part of a region's width, for books
 * built from two halves that share one spine picture.
 */
export type Face = { region: keyof Regions; uSlice?: [number, number] };

export function bookBox(
    w: number,
    h: number,
    d: number,
    regions: Regions,
    faces: [Face, Face, Face, Face, Face, Face],
) {
    const geo = new BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    faces.forEach(({ region, uSlice = [0, 1] }, f) => {
        const [r0, r1] = regions[region];
        const u0 = r0 + (r1 - r0) * uSlice[0];
        const u1 = r0 + (r1 - r0) * uSlice[1];
        for (let i = f * 4; i < f * 4 + 4; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    });
    uv.needsUpdate = true;
    return geo;
}

/** The book on the shelf: spine at +z, front cover at +x. */
export function shelfBookGeometry(size: BookSize, regions: Regions) {
    return bookBox(size.thickness, size.height, size.depth, regions, [
        { region: 'front' }, // +x front cover
        { region: 'back' }, // -x back cover
        { region: 'pages' }, // top edge
        { region: 'pages' }, // bottom edge
        { region: 'spine' }, // +z spine
        { region: 'pages' }, // -z fore-edge
    ]);
}
