/**
 * Downloads the PBR texture sets used by src/world/materials/surfaces.ts:
 * `pnpm textures`.
 *
 * Each set comes from Poly Haven (CC0) at 1K and is re-encoded to WebP into
 * public/textures/<set>/: color.webp, normal.webp (OpenGL convention, which
 * three.js uses) and arm.webp (AO, roughness, metalness packed in R, G, B).
 * Sets that already exist are skipped; pass a set name to re-fetch it.
 */

import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = 'public/textures';
const UA = { 'User-Agent': 'knowledge-loft-texture-fetch/1.0' };

/** Folder name → Poly Haven texture id. `noColor`: painted surfaces skip the colour map. */
const SETS = {
    parquet: { id: 'herringbone_parquet' },
    concrete: { id: 'brushed_concrete' },
    plaster: { id: 'plastered_wall_04', noColor: true },
    brick: { id: 'factory_brick' },
    oak: { id: 'oak_veneer_01' },
    asphalt: { id: 'clean_asphalt' },
    pavers: { id: 'concrete_pavers_02' },
};

const MAPS = { color: 'Diffuse', normal: 'nor_gl', arm: 'arm' };

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function fetchSet(name, { id, noColor }) {
    const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA });
    if (!res.ok) throw new Error(`Poly Haven: ${res.status} for ${id}`);
    const files = await res.json();
    const dir = join(OUT, name);
    await mkdir(dir, { recursive: true });
    for (const [file, key] of Object.entries(MAPS)) {
        if (file === 'color' && noColor) continue;
        const url = files[key]?.['1k']?.jpg?.url ?? files[key]?.['1k']?.png?.url;
        if (!url) throw new Error(`${id}: no 1K ${key} map`);
        const img = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());
        await sharp(img)
            .webp({ quality: 82 })
            .toFile(join(dir, `${file}.webp`));
    }
    console.log(`- ${name}: ${id}`);
}

const only = process.argv.slice(2);
for (const [name, set] of Object.entries(SETS)) {
    if (only.length ? !only.includes(name) : await exists(join(OUT, name))) continue;
    await fetchSet(name, set);
}
