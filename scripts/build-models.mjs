/**
 * Downloads and optimises the loft's 3D models: `pnpm models`.
 *
 * Every model in MODELS goes through the same pipeline and lands in
 * public/models/<name>.glb, ready for useGLTF:
 *
 *   1. Source. Poly Haven models are downloaded (1K glTF) into .models-raw/
 *      (git-ignored). Sketchfab models need a logged-in download, so you drop
 *      the GLB into .models-raw/sketchfab/ yourself; missing ones are skipped.
 *   2. Clean-up. dedup (identical textures/materials become one), flatten +
 *      join (meshes sharing a material merge into one draw call), weld.
 *   3. simplify (optional, per model): meshoptimizer removes triangles while
 *      keeping the silhouette within `error` (a fraction of the model's size).
 *   4. Textures are resized (1024 for furniture, 512 for small props: you never
 *      see a vase from closer than ~50 cm) and re-encoded as WebP.
 *   5. meshopt compression: vertex data quantised and packed, typically 3-5x
 *      smaller. drei's useGLTF ships the decoder.
 *
 * Re-running is cheap: downloads are cached, and only models whose output is
 * missing get rebuilt (pass --force to rebuild all, or names to pick some).
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join as joinPath } from 'node:path';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
    center,
    dedup,
    flatten,
    join,
    meshopt,
    palette,
    prune,
    simplify,
    textureCompress,
    weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

const RAW = '.models-raw';
const OUT = 'public/models';
const UA = { 'User-Agent': 'knowledge-loft-model-build/1.0' };

/**
 * name: output file. id: Poly Haven asset id, or `file` for a Sketchfab GLB.
 * tex: max texture size. simplify: target triangle ratio (omit to keep all); error:
 * how far (as a fraction of the model's size) simplifying may move the surface.
 * scale: unit fix (Sketchfab files come in cm, dm...; we want metres).
 * palette: merge untextured materials into one small colour-swatch texture, so
 * a model with dozens of flat-coloured parts draws in a few calls.
 * fix(doc): model-specific clean-up before the shared pipeline.
 */
const MODELS = [
    // lobby
    { name: 'sofa', id: 'sofa_02', tex: 1024 },
    { name: 'lounge-chair', id: 'mid_century_lounge_chair', tex: 1024 },
    { name: 'armchair', id: 'modern_arm_chair_01', tex: 1024 },
    { name: 'ottoman', id: 'Ottoman_01', tex: 512 },
    { name: 'coffee-table', id: 'modern_coffee_table_01', tex: 1024 },
    { name: 'desk', id: 'metal_office_desk', tex: 1024 },
    { name: 'steel-shelves', id: 'steel_frame_shelves_03', tex: 1024 },
    { name: 'pendant', id: 'modern_ceiling_lamp_01', tex: 512 },
    { name: 'pillows', id: 'throw_pillows_01', tex: 512 },
    { name: 'plant-pot', id: 'potted_plant_02', tex: 1024, simplify: 0.4, error: 0.01 },
    { name: 'plant-tall', id: 'potted_plant_01', tex: 512, simplify: 0.15, error: 0.01 },
    { name: 'vase', id: 'ceramic_vase_01', tex: 512 },
    // projects gallery
    { name: 'industrial-pendant', id: 'hanging_industrial_lamp', tex: 512 },
    { name: 'stool', id: 'metal_stool_02', tex: 512 },
    // career corridor
    { name: 'clock', id: 'wall_clock', tex: 512 },
    { name: 'wall-lamp', id: 'industrial_wall_lamp', tex: 512 },
    // hobbies lounge
    { name: 'round-table', id: 'coffee_table_round_01', tex: 1024 },
    { name: 'cube-shelves', id: 'wooden_display_shelves_01', tex: 1024 },
    { name: 'books', id: 'book_encyclopedia_set_01', tex: 512, simplify: 0.12, error: 0.004 },
    { name: 'desk-lamp', id: 'desk_lamp_arm_01', tex: 512, simplify: 0.5 },
    { name: 'laptop', id: 'classic_laptop', tex: 512, simplify: 0.6 },
    { name: 'shark', id: 'bronze_shark_statue', tex: 512 },
    { name: 'ray', id: 'bronze_ray_statue', tex: 512 },
    { name: 'shell', id: 'lambis_shell', tex: 512 },

    // Sketchfab (CC BY 4.0): downloaded by hand into .models-raw/sketchfab/
    {
        name: 'gaming-pc',
        file: 'gaming_desktop_pc.glb',
        title: 'Gaming Desktop PC',
        author: 'Yolala3d',
        url: 'https://sketchfab.com/3d-models/d1d8282c9916438091f11aeb28787b66',
        tex: 512,
        scale: 0.1, // modelled in decimetres
        palette: true, // 86 materials, most of them plain colours
        // The desk slab it sits on (it goes on our own table), the screenshot on
        // the monitor, and brand decals: logos of real companies and a YouTuber.
        fix: (doc) => {
            dropNodes(doc, [
                /^Cube$/,
                /MY SCREEN/,
                /logo/i,
                /nvidia|geforce|aorus-v1|souris|MOBOAORUS|maxresdefault/i,
            ]);
            // Clearcoat and specular turn every part into a MeshPhysicalMaterial
            // (a heavier shader) for a sheen you can't see at this size.
            removeExtension(doc, 'KHR_materials_clearcoat');
            removeExtension(doc, 'KHR_materials_specular');
        },
    },
    {
        name: 'turntable',
        file: 'yamaha_tt-300_record_player.glb',
        title: 'Yamaha TT-300 Record Player',
        author: 'AleixoAlonso',
        url: 'https://sketchfab.com/3d-models/3577a2a1a0c24218bd5d768beccf218e',
        tex: 1024,
        scale: 0.01, // modelled in centimetres
        // The whole player shares one see-through "transmission" material, which
        // costs three.js an extra render of the scene every frame. Make the body
        // opaque and give only the dust cover a cheap smoked-glass material.
        fix: (doc) => {
            removeExtension(doc, 'KHR_materials_transmission');
            const [body] = doc.getRoot().listMaterials();
            body.setAlphaMode('OPAQUE');
            const glass = body
                .clone()
                .setName('dust cover')
                .setAlphaMode('BLEND')
                .setBaseColorFactor([1, 1, 1, 0.3])
                .setRoughnessFactor(0.08)
                .setMetallicFactor(0);
            for (const node of doc.getRoot().listNodes()) {
                if (!/Cover/.test(node.getName())) continue;
                for (const prim of node.getMesh()?.listPrimitives() ?? []) prim.setMaterial(glass);
            }
        },
    },
    {
        name: 'scuba-mask',
        file: 'scuba_goggles_and_snorkel.glb',
        title: 'Scuba Goggles And Snorkel',
        author: 'milansaman21',
        url: 'https://sketchfab.com/3d-models/6552ed7809cb4eaca6fd3c987165adbb',
        tex: 512,
    },
    {
        name: 'floor-lamp',
        file: 'floor_lamp.glb',
        title: 'floor lamp',
        author: 'Jack John',
        url: 'https://sketchfab.com/3d-models/floor-lamp-7044aedec91b4e28916a20b0ce026217',
        tex: 512,
        palette: true, // six plain-coloured materials, no textures
    },
    {
        name: 'monstera',
        file: 'monstera_deliciosa_potted_mid-century_plant.glb',
        title: 'Monstera Deliciosa Potted Mid-Century plant',
        author: 'ChubbyPanda',
        url: 'https://sketchfab.com/3d-models/1ab9bf841df04c07b1819be596327629',
        tex: 1024,
    },
];

/** Removes nodes whose name matches any pattern, with everything under them. */
function dropNodes(doc, patterns) {
    const doomed = new Set();
    for (const node of doc.getRoot().listNodes()) {
        if (patterns.some((p) => p.test(node.getName()))) node.traverse((n) => doomed.add(n));
    }
    for (const node of doomed) node.dispose(); // meshes left unused go in prune()
}

function removeExtension(doc, name) {
    for (const ext of doc.getRoot().listExtensionsUsed()) {
        if (ext.extensionName === name) ext.dispose();
    }
}

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function download(url, path) {
    if (await exists(path)) return;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

/** Fetches a Poly Haven model's 1K glTF (plus its textures); returns the .gltf path. */
async function fetchPolyHaven(id) {
    const dir = joinPath(RAW, 'polyhaven', id);
    const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA });
    if (!res.ok) throw new Error(`Poly Haven: ${res.status} for ${id}`);
    const gltf = (await res.json()).gltf?.['1k']?.gltf;
    if (!gltf) throw new Error(`Poly Haven: no 1K glTF for ${id}`);
    const main = joinPath(dir, `${id}.gltf`);
    await download(gltf.url, main);
    for (const [rel, file] of Object.entries(gltf.include ?? {})) {
        await download(file.url, joinPath(dir, rel));
    }
    return main;
}

function triangles(doc) {
    let n = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const idx = prim.getIndices();
            n += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
        }
    }
    return Math.round(n);
}

async function build(io, model) {
    const src = model.file
        ? joinPath(RAW, 'sketchfab', model.file)
        : await fetchPolyHaven(model.id);
    if (!(await exists(src))) {
        console.log(`- ${model.name}: skipped, put ${model.file} in ${RAW}/sketchfab/`);
        return;
    }
    const before = (await stat(src)).size;
    const doc = await io.read(src);
    const tris = triangles(doc);

    model.fix?.(doc);
    if (model.scale) {
        for (const node of doc.getRoot().listScenes()[0].listChildren()) {
            node.setScale(node.getScale().map((v) => v * model.scale));
        }
    }

    await doc.transform(
        dedup(),
        ...(model.palette ? [palette({ min: 2 })] : []),
        flatten(),
        join(),
        weld(),
        ...(model.simplify
            ? [
                  simplify({
                      simplifier: MeshoptSimplifier,
                      ratio: model.simplify,
                      error: model.error ?? 0.002,
                  }),
              ]
            : []),
        // Origin at the bottom centre: place it on the floor and it stands on it.
        center({ pivot: 'below' }),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [model.tex, model.tex] }),
        prune(),
        meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );

    const out = joinPath(OUT, `${model.name}.glb`);
    await io.write(out, doc);
    const after = (await stat(out)).size;
    const kb = (b) => `${Math.round(b / 1024)} KB`;
    console.log(
        `- ${model.name}: ${tris} → ${triangles(doc)} tris, ${doc.getRoot().listMaterials().length} materials, ${kb(after)} (gltf ${kb(before)} + textures)`,
    );
}

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const only = args.filter((a) => !a.startsWith('--'));

    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const io = new NodeIO()
        .setLogger(new Logger(Logger.Verbosity.WARN))
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'meshopt.encoder': MeshoptEncoder,
            'meshopt.decoder': MeshoptDecoder,
        });
    await mkdir(OUT, { recursive: true });

    for (const model of MODELS) {
        if (only.length && !only.includes(model.name)) continue;
        if (!force && !only.length && (await exists(joinPath(OUT, `${model.name}.glb`)))) continue;
        await build(io, model);
    }

    await writeCredits();
}

async function writeCredits() {
    const rows = MODELS.map((m) =>
        m.file
            ? `| \`${m.name}.glb\` | [${m.title}](${m.url}) by ${m.author} | CC BY 4.0 |`
            : `| \`${m.name}.glb\` | [${m.id}](https://polyhaven.com/a/${m.id}) (Poly Haven) | CC0 |`,
    );
    const text = `# Model credits

Generated by \`pnpm models\` (scripts/build-models.mjs); edit the MODELS list there.
Poly Haven models are CC0 (public domain). CC BY models require the credit below.

All models were changed for the web: meshes merged and simplified, textures resized and
re-encoded, and some parts removed or re-materialed (each model's \`fix\` in the script).

| File | Source | Licence |
| ---- | ------ | ------- |
${rows.join('\n')}
`;
    const path = joinPath(OUT, 'CREDITS.md');
    // Formatted like the rest of the repo, so `pnpm format:check` stays green.
    const formatted = await format(text, { ...(await resolveConfig(path)), filepath: path });
    const old = (await exists(path)) ? await readFile(path, 'utf8') : '';
    if (old !== formatted) await writeFile(path, formatted);
}

await main();
