'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    CanvasTexture,
    SRGBColorSpace,
    Vector3,
    type Group,
    type Mesh,
    type MeshStandardMaterial,
} from 'three';
import { NOTE_KINDS, notes } from '@/content';
import { useWorld } from '@/store/world';
import { Block } from '@/world/greybox/Block';
import { Interactable, useIsFocused } from '@/world/interaction/Interactable';
import { drawBook, shelfBookGeometry } from './book';
import { SHELF_POSITION } from './browse';
import { layoutShelf, SPINE_Z, type BookSlot } from './layout';

/**
 * The lobby bookshelf's books: the knowledge base, one book per note in
 * src/content/notes.
 *
 * Using it is two steps, big target first: walking around, the shelf as a
 * whole is what you aim at ("Browse"), which steps you up to it
 * (ShelfCamera). There, the books answer one by one: aim at one and it
 * slides out a little; use it and it comes to you and opens (CarriedBook).
 * A spine is 1–6 cm wide, a fiddly thing to hit from across the room, and
 * easy to take for decoration; a 2 m shelf isn't.
 *
 * Until a first book is taken, the shelf also invites you: the newest note
 * is left sticking out, and a glow runs along the spines when you come near.
 * Both stop once you've found the books, so they never become noise.
 *
 * Each book is its own mesh with its own material (one draw call each).
 * A single instanced mesh would draw them all at once, but then every book
 * shares a material, and these need to glow, slide and fly one at a time.
 * At a dozen or two books, separate meshes are the simpler, cheaper choice.
 */

/**
 * Books on the shelf, by slug: their group and resting position (shelf
 * frame), which is where a carried book flies from and back to. The resting
 * position, not the group's current one, which may be pulled out a little.
 */
export const bookSlots = new Map<string, { group: Group; rest: [number, number, number] }>();

const layout = layoutShelf(notes);

/** The newest note on the shelf: the one left sticking out. */
const newest = layout.books.reduce<BookSlot | undefined>(
    (best, slot) => (!best || slot.note.updated > best.note.updated ? slot : best),
    undefined,
)?.note.slug;

/** How far a book slides out when you aim at it, in metres. */
const PEEK = 0.035;
/** How far the newest book sticks out until you've taken one. */
const INVITE = 0.055;
const GLOW = 0.22;
const INVITE_GLOW = 0.12;

/**
 * The glow along the spines: a soft band that sweeps left to right across
 * every row at once. `t` is seconds into the sweep (-1 = not running).
 * It starts when you come within NEAR of the shelf while facing it, and
 * can only start again after you've walked away past FAR, so pacing in
 * front of the shelf doesn't set it off over and over.
 */
const sweep = { t: -1, armed: true };
const SWEEP = 1.4; // seconds, end to end
const NEAR = 4;
const FAR = 5.5;
const FROM = -1.35; // shelf-frame x where the band starts and ends, just past the books
const TO = 1.35;

function sweepGlow(x: number) {
    if (sweep.t < 0) return 0;
    const front = FROM + ((TO - FROM) * sweep.t) / SWEEP;
    const d = (x - front) / 0.16;
    return 0.4 * Math.exp(-d * d);
}

const shelfCentre = new Vector3(SHELF_POSITION[0], 1.3, SHELF_POSITION[2]);
const toShelf = new Vector3();
const facing = new Vector3();

export function Bookshelf() {
    const browsing = useWorld((s) => s.shelf !== null);

    // Watch for the visitor coming up to the shelf, and run the sweep.
    useFrame(({ camera }, delta) => {
        const w = useWorld.getState();
        if (sweep.t >= 0) {
            sweep.t += Math.min(delta, 0.05);
            if (sweep.t > SWEEP) sweep.t = -1;
        }
        if (w.readABook || w.mode !== 'exploring' || w.shelf) return;
        toShelf.subVectors(shelfCentre, camera.position);
        toShelf.y = 0;
        const distance = toShelf.length();
        if (distance > FAR) sweep.armed = true;
        if (!sweep.armed || distance > NEAR) return;
        camera.getWorldDirection(facing);
        facing.y = 0;
        // Roughly facing it (within ~45°): a sweep behind your back is wasted.
        if (facing.normalize().dot(toShelf.normalize()) > 0.7) {
            sweep.armed = false;
            sweep.t = 0;
        }
    });

    return (
        <group position={SHELF_POSITION}>
            {/* Walking around: the whole shelf is one big target. An invisible box
                over its front, from the low boards to the top row's books. */}
            {!browsing && (
                <Interactable
                    id="bookshelf"
                    label={`Knowledge base · ${layout.books.length} notes`}
                    action={{ kind: 'shelf' }}
                >
                    <mesh visible={false} position={[0, 1.33, 0.2]}>
                        <boxGeometry args={[2.3, 1.5, 0.3]} />
                    </mesh>
                </Interactable>
            )}
            {layout.books.map((slot) => (
                <Interactable
                    key={slot.note.slug}
                    id={`book:${slot.note.slug}`}
                    label={`${NOTE_KINDS[slot.note.kind]} · ${slot.note.title}`}
                    action={{ kind: 'book', book: slot.note.slug }}
                >
                    <ShelfBook slot={slot} invite={slot.note.slug === newest} />
                    <AimBox slot={slot} />
                </Interactable>
            ))}
            {/* a steel bookend after the last book in each row */}
            {layout.ends.map(({ x, y }) => (
                <group key={`${x},${y}`}>
                    <Block
                        size={[0.004, 0.16, 0.12]}
                        position={[x, y + 0.08, 0.21]}
                        surface="metal"
                    />
                    <Block
                        size={[0.07, 0.004, 0.12]}
                        position={[x + 0.035, y + 0.002, 0.21]}
                        surface="metal"
                    />
                </group>
            ))}
            <ShelfSign />
        </group>
    );
}

/**
 * Aim assist for a book: an invisible box a little bigger than the book,
 * reaching just in front of its spine. Neighbours' boxes overlap, and the
 * InteractionSystem picks the one whose centre is nearest the crosshair
 * (the same trick as the constellation's stars), so aiming at the 4 mm gap
 * between two books still picks one, and a 1 cm notebook is as easy to hit
 * as a binder.
 */
function AimBox({ slot }: { slot: BookSlot }) {
    const { size, position } = slot;
    const front = SPINE_Z + 0.01;
    const back = position[2] - size.depth / 2;
    return (
        <mesh
            visible={false}
            position={[position[0], position[1], (front + back) / 2]}
            userData={{ aimAssist: true }}
        >
            <boxGeometry args={[size.thickness + 0.03, size.height + 0.03, front - back]} />
        </mesh>
    );
}

function ShelfBook({ slot, invite }: { slot: BookSlot; invite: boolean }) {
    const { note, size, position } = slot;
    const focused = useIsFocused();
    const taken = useWorld((s) => s.book === note.slug);
    const group = useRef<Group>(null);
    const mesh = useRef<Mesh>(null);

    const { texture, regions } = useMemo(() => drawBook(note, size), [note, size]);
    const geometry = useMemo(() => shelfBookGeometry(size, regions), [size, regions]);
    useEffect(
        () => () => {
            texture.dispose();
            geometry.dispose();
        },
        [texture, geometry],
    );

    useEffect(() => {
        const g = group.current;
        if (!g) return;
        bookSlots.set(note.slug, { group: g, rest: position });
        return () => {
            bookSlots.delete(note.slug);
        };
    }, [note.slug, position]);

    // Ease toward pulled-out or pushed-in: an exponential approach, which
    // feels the same at any frame rate (unlike a fixed step per frame).
    useFrame((_, delta) => {
        const g = group.current;
        const m = mesh.current;
        if (!g || !m) return;
        const inviting = invite && !useWorld.getState().readABook;
        const out = focused ? PEEK : inviting ? INVITE : 0;
        g.position.z += (position[2] + out - g.position.z) * (1 - Math.exp(-delta * 14));
        // Sticking out is easy to miss head-on, so the invite also glows, faintly.
        (m.material as MeshStandardMaterial).emissiveIntensity = Math.max(
            focused ? GLOW : inviting ? INVITE_GLOW : 0,
            sweepGlow(position[0]),
        );
    });

    return (
        <group ref={group} position={position}>
            <mesh ref={mesh} geometry={geometry} visible={!taken} receiveShadow>
                <meshStandardMaterial
                    map={texture}
                    roughness={0.85}
                    emissive="#ffffff"
                    emissiveMap={texture}
                    emissiveIntensity={0}
                />
            </mesh>
        </group>
    );
}

/**
 * A small lit strip on the front edge of the eye-level board: says what
 * the shelf is from across the room. Warm like the kiosk's "on" strip,
 * and drawn brighter than white so the bloom gives it a soft glow.
 */
const SIGN = { width: 0.62, height: 0.05, x: -0.63, y: 1.285, z: 0.345 };
const SIGN_TEXT = 'KNOWLEDGE BASE · TAKE A BOOK';

function ShelfSign() {
    const texture = useMemo(() => {
        const px = 2000; // per metre
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(SIGN.width * px);
        canvas.height = Math.round(SIGN.height * px);
        const g = canvas.getContext('2d')!;
        g.fillStyle = '#141416';
        g.fillRect(0, 0, canvas.width, canvas.height);
        const mono =
            getComputedStyle(document.documentElement)
                .getPropertyValue('--font-plex-mono')
                .trim() || 'ui-monospace, monospace';
        g.font = `600 ${Math.round(canvas.height * 0.46)}px ${mono}`;
        g.letterSpacing = `${Math.round(canvas.height * 0.12)}px`;
        g.fillStyle = '#ffd3a1';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(SIGN_TEXT, canvas.width / 2, canvas.height * 0.54);
        const t = new CanvasTexture(canvas);
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 8;
        return t;
    }, []);
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        <mesh position={[SIGN.x, SIGN.y, SIGN.z]}>
            <planeGeometry args={[SIGN.width, SIGN.height]} />
            <meshBasicMaterial map={texture} color={[1.7, 1.35, 1.1]} toneMapped={false} />
        </mesh>
    );
}
