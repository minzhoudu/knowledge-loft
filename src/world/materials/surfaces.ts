import {
    BoxGeometry,
    RepeatWrapping,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
    type Texture,
} from 'three';

/**
 * The material library: what every surface in the loft is made of.
 *
 * Textured surfaces use PBR ("physically based rendering") texture sets from
 * Poly Haven (CC0). Each set is three images:
 * - color:  the surface's own colour, without any lighting baked in.
 * - normal: tiny bumps (wood grain, plaster trowel marks, mortar lines),
 *           stored as a direction per pixel. Light catches them as if the
 *           surface were really bumpy, for the cost of one texture lookup.
 * - arm:    three greyscale maps packed into one image's channels:
 *           R = Ambient occlusion (crevices that light can't reach),
 *           G = Roughness (matte vs. glossy, per pixel),
 *           B = Metalness (unused here; all these materials are non-metal).
 *           three.js reads AO from R and roughness from G of the same image.
 */

export type Surface =
    | 'floor' // herringbone parquet: lobby and lounge
    | 'concrete' // polished concrete: gallery and corridor
    | 'wall' // painted plaster
    | 'ceiling'
    | 'brick' // the loft's exposed brick accent wall
    | 'wood' // oak furniture
    | 'accent' // anything you can inspect: oak with a warm tint, so it stands out
    | 'metal' // black steel: window frames, handles, legs
    | 'plant'
    | 'asphalt' // the street outside
    | 'pavers' // the pavement outside
    | 'kerb'; // kerbstones: pale concrete

type SetName = 'parquet' | 'concrete' | 'plaster' | 'brick' | 'oak' | 'asphalt' | 'pavers';

/** Real-world size of one texture tile, in metres (from Poly Haven's scan sizes). */
const TILE: Record<SetName, number> = {
    parquet: 3.4,
    concrete: 2.5,
    plaster: 3.2,
    brick: 1.5,
    oak: 1.83,
    asphalt: 2.1,
    pavers: 2.0,
};

type Look = {
    set?: SetName;
    color: string;
    roughness?: number;
    metalness?: number;
    normalScale?: number;
    /** How much it reflects the sky (environment map); 1 = physically full. */
    envMapIntensity?: number;
};

const LOOKS: Record<Surface, Look> = {
    floor: { set: 'parquet', color: '#ffffff', envMapIntensity: 0.45 },
    concrete: { set: 'concrete', color: '#cfcac3', roughness: 0.8, envMapIntensity: 0.6 },
    wall: { set: 'plaster', color: '#fbf1e4', normalScale: 0.6 },
    ceiling: { set: 'plaster', color: '#fdf6ec', normalScale: 0.3 },
    brick: { set: 'brick', color: '#ffffff' },
    wood: { set: 'oak', color: '#ffffff' },
    accent: { set: 'oak', color: '#f2b77a', roughness: 0.8 },
    metal: { color: '#26282b', roughness: 0.42, metalness: 0.75 },
    plant: { color: '#55804a', roughness: 0.75 },
    asphalt: { set: 'asphalt', color: '#ffffff', envMapIntensity: 0.5 },
    pavers: { set: 'pavers', color: '#ffffff', envMapIntensity: 0.5 },
    kerb: { set: 'concrete', color: '#e4e0d8', roughness: 0.9, envMapIntensity: 0.5 },
};

/**
 * Sets used as paint over texture: the scan's colour image is skipped and
 * the surface takes its `color` instead, keeping only its bumps and
 * roughness. Real plaster walls are painted; the scanned plaster is grey.
 */
const PAINTED: SetName[] = ['plaster'];

type TextureSet = { map?: Texture; normalMap: Texture; arm: Texture };

// Loaded on first use (in the browser), then shared by every block: one
// texture upload per image, however many walls use it.
let textures: Record<SetName, TextureSet> | null = null;

function loadTextures() {
    const loader = new TextureLoader();
    const load = (set: SetName, file: string, color = false) => {
        const t = loader.load(`/textures/${set}/${file}.webp`);
        t.wrapS = t.wrapT = RepeatWrapping;
        // UVs are in metres (see worldBox), so one repeat = one tile's real size.
        t.repeat.set(1 / TILE[set], 1 / TILE[set]);
        // Sharper at glancing angles (floors seen from eye height).
        t.anisotropy = 8;
        // Colour images are sRGB; data images (normals, roughness) are linear numbers.
        if (color) t.colorSpace = SRGBColorSpace;
        return t;
    };
    const sets = {} as Record<SetName, TextureSet>;
    for (const set of Object.keys(TILE) as SetName[]) {
        sets[set] = {
            map: PAINTED.includes(set) ? undefined : load(set, 'color', true),
            normalMap: load(set, 'normal'),
            arm: load(set, 'arm'),
        };
    }
    return sets;
}

/** Props for a <meshStandardMaterial> of this surface. */
export function surfaceProps(surface: Surface) {
    const look = LOOKS[surface];
    const base = {
        color: look.color,
        roughness: look.roughness ?? 1,
        metalness: look.metalness ?? 0,
        envMapIntensity: look.envMapIntensity ?? 1,
    };
    if (!look.set) return base;
    textures ??= loadTextures();
    const t = textures[look.set];
    const n = look.normalScale ?? 1;
    return {
        ...base,
        map: t.map,
        normalMap: t.normalMap,
        normalScale: new Vector2(n, n),
        roughnessMap: t.arm, // multiplied by `roughness`
        aoMap: t.arm,
    };
}

/** Props for a plain-coloured material (one-off colours: fabric, ceramics). */
export function plainProps(color: string) {
    return { color, roughness: 0.8, metalness: 0 };
}

/**
 * A box whose texture coordinates are in metres along the world axes,
 * instead of 0..1 stretched over each face.
 *
 * A normal box squeezes the whole texture onto every face, so a 10 m wall
 * and a 10 cm shelf would show the same number of bricks. Here each face is
 * projected from the axis it faces (floors from above, walls from the side),
 * using the block's position, so neighbouring blocks (a wall split around a
 * window) continue the pattern seamlessly, with each brick its real size.
 */
export function worldBox(
    size: [number, number, number],
    position: [number, number, number],
    rotationY = 0,
) {
    const g = new BoxGeometry(...size);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        // Rotate about Y (as the mesh will be), then move to the block's position.
        const x = lx * c + lz * s + position[0];
        const y = pos.getY(i) + position[1];
        const z = -lx * s + lz * c + position[2];
        const nx = Math.abs(nor.getX(i) * c + nor.getZ(i) * s);
        const ny = Math.abs(nor.getY(i));
        const nz = Math.abs(-nor.getX(i) * s + nor.getZ(i) * c);
        if (ny >= nx && ny >= nz) uv.setXY(i, x, z);
        else if (nx >= nz) uv.setXY(i, z, y);
        else uv.setXY(i, x, y);
    }
    return g;
}
