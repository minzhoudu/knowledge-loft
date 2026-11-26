'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Quaternion, Vector3, type Group, type PerspectiveCamera } from 'three';
import { NOTE_AREAS, NOTE_KINDS, noteBySlug, type Note } from '@/content';
import { useWorld } from '@/store/world';
import { resumeFromKey } from '@/world/player/input';
import { readableZoom } from '@/world/reading';
import { bookBox, bookSize, drawBook, type BookSize } from './book';
import { bookSlots } from './Bookshelf';

/**
 * The book in your hands: taken from the shelf, read, put back.
 *
 * The camera stays where you stand; the book comes to you. Its trip:
 *   taking:    slide out of the gap → fly to in front of your eyes → swing open
 *   open:      the note on its pages (real HTML, like the desk monitor)
 *   returning: close → fly back → slide into its gap
 *
 * It's built from two halves hinged at the spine, in a frame where the
 * spine runs up the y axis at x = 0, pages extend to +x, and the front
 * cover faces +z. Opening turns the front half 180° about the spine, so it
 * ends up beside the back half, inner page facing you: a two-page spread
 * centred on the spine.
 *
 * On the shelf the same book stands with its spine toward the room (+z of
 * the shelf) and its front cover at +x. Turning the open-book frame by 90°
 * about y lines the two up, which is how the flight starts exactly where
 * the shelf copy stood.
 */
export function CarriedBook() {
    const slug = useWorld((s) => s.book);
    const note = slug ? noteBySlug(slug) : undefined;
    // A new key per book: a fresh trip (and textures) each time.
    return note ? <Book key={note.slug} note={note} /> : null;
}

const SLIDE = 0.2; // seconds
const FLY = 0.6;
const OPEN = 0.45;
const CLOSE = 0.35;
/** How far the book slides out of its gap before it flies (a bit more than its depth). */
const SLIDE_OUT = 0.18;
/** Room around the open spread in your view (1 = edge to edge). */
const MARGIN = 1.25;
/** Each page's layout width in CSS px (the spread is twice this). */
const PAGE_PX = 480;

const smootherstep = (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
};

const QUARTER_TURN = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const Z = new Vector3(0, 0, 1);

/** Where the closed book stood on the shelf, in the open-book frame. */
function slotPose(slug: string, size: BookSize, outPos: Vector3, outQuat: Quaternion) {
    const slot = bookSlots.get(slug);
    const shelf = slot?.group.parent;
    if (!slot || !shelf) return false;
    shelf.updateWorldMatrix(true, false);
    outPos.set(...slot.rest).applyMatrix4(shelf.matrixWorld);
    shelf.getWorldQuaternion(outQuat);
    // Spine = the shelf book's +z face; the open-book frame's origin.
    outPos.addScaledVector(Z.clone().applyQuaternion(outQuat), size.depth / 2);
    outQuat.multiply(QUARTER_TURN);
    return true;
}

/**
 * The trip, in plain mutable state, read and written every frame. Module
 * level like SeatCamera's rig: one book in your hands at a time, and the
 * render loop allocates nothing.
 */
const trip = {
    started: false,
    mode: 'taking' as 'taking' | 'returning',
    t: 0,
    angle: 0, // front half's opening angle, 0 (closed) .. π (open)
    slotPos: new Vector3(),
    slotQuat: new Quaternion(),
    outPos: new Vector3(),
    holdPos: new Vector3(),
    holdQuat: new Quaternion(),
    fromPos: new Vector3(),
    fromQuat: new Quaternion(),
    fromAngle: 0,
};

const left = new Vector3();
const right = new Vector3();

function Book({ note }: { note: Note }) {
    const viewport = useThree((s) => s.size);
    const size = useMemo(() => bookSize(note), [note]);
    const phase = useWorld((s) => s.bookPhase);
    const root = useRef<Group>(null);
    const hinge = useRef<Group>(null);
    const { texture, regions } = useMemo(() => drawBook(note, size), [note, size]);

    // The two halves, each half the book's thickness (see book.ts for the
    // face order). Spine faces share the spine picture, half each.
    const { back, front } = useMemo(() => {
        const { depth: w, height: h, thickness: t } = size;
        const page = { region: 'pages' } as const;
        return {
            back: bookBox(w, h, t / 2, regions, [
                page, // +x fore-edge
                { region: 'spine', uSlice: [0, 0.5] }, // -x spine
                page,
                page,
                page, // +z the right-hand page
                { region: 'back' }, // -z back cover
            ]),
            front: bookBox(w, h, t / 2, regions, [
                page,
                { region: 'spine', uSlice: [0.5, 1] },
                page,
                page,
                { region: 'front' }, // +z front cover
                page, // -z the left-hand page, once open
            ]),
        };
    }, [size, regions]);
    useEffect(
        () => () => {
            texture.dispose();
            back.dispose();
            front.dispose();
        },
        [texture, back, front],
    );

    // How much to zoom the pages' text; measured as the book lands open.
    const [zoom, setZoom] = useState(1);

    // Each book starts a new trip.
    useEffect(() => {
        trip.started = false;
        return () => {
            trip.started = false;
        };
    }, []);

    useFrame(({ camera }, delta) => {
        const r = root.current;
        const h = hinge.current;
        if (!r || !h) return;
        const world = useWorld.getState();
        const dt = Math.min(delta, 0.05);

        if (!trip.started) {
            trip.started = true;
            trip.mode = 'taking';
            trip.t = 0;
            trip.angle = 0;
            if (!slotPose(note.slug, size, trip.slotPos, trip.slotQuat)) {
                world.setBookPhase(null);
                resumeFromKey();
                return;
            }
            r.visible = true; // hidden until now, so it never flashes at the origin
            trip.outPos
                .copy(Z)
                .applyQuaternion(trip.slotQuat.clone().multiply(QUARTER_TURN.clone().invert()))
                .multiplyScalar(SLIDE_OUT)
                .add(trip.slotPos);
            // Hold it centred, as close as the open spread fits the view (see
            // seatedPose in seats.ts for the same fit, worked through).
            const cam = camera as PerspectiveCamera;
            const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
            const d = Math.max(
                (size.height * MARGIN) / (2 * tanHalf),
                (2 * size.depth * MARGIN) / (2 * tanHalf * cam.aspect),
            );
            camera.getWorldDirection(trip.holdPos);
            trip.holdPos.multiplyScalar(d).add(camera.position);
            trip.holdQuat.copy(camera.quaternion);
        }

        if (world.bookPhase === 'returning' && trip.mode === 'taking') {
            // Start back from wherever the book is now, even mid-flight.
            trip.mode = 'returning';
            trip.t = 0;
            trip.fromPos.copy(r.position);
            trip.fromQuat.copy(r.quaternion);
            trip.fromAngle = trip.angle;
        }
        if (world.bookPhase === 'open') return; // lying open in front of you

        trip.t += dt;
        const t = trip.t;
        if (trip.mode === 'taking') {
            if (t < SLIDE) {
                r.position.lerpVectors(trip.slotPos, trip.outPos, smootherstep(t / SLIDE));
                r.quaternion.copy(trip.slotQuat);
            } else if (t < SLIDE + FLY) {
                const e = smootherstep((t - SLIDE) / FLY);
                r.position.lerpVectors(trip.outPos, trip.holdPos, e);
                r.quaternion.slerpQuaternions(trip.slotQuat, trip.holdQuat, e);
            } else {
                r.position.copy(trip.holdPos);
                r.quaternion.copy(trip.holdQuat);
                trip.angle = Math.PI * smootherstep((t - SLIDE - FLY) / OPEN);
                if (t >= SLIDE + FLY + OPEN) {
                    r.updateWorldMatrix(true, false);
                    left.set(-size.depth, 0, 0).applyMatrix4(r.matrixWorld);
                    right.set(size.depth, 0, 0).applyMatrix4(r.matrixWorld);
                    setZoom(readableZoom(camera, viewport.width, left, right, PAGE_PX * 2));
                    world.setBookPhase('open');
                }
            }
        } else {
            const closeFor = CLOSE * (trip.fromAngle / Math.PI);
            if (t < closeFor) {
                trip.angle = trip.fromAngle * (1 - smootherstep(t / closeFor));
            } else if (t < closeFor + FLY) {
                trip.angle = 0;
                const e = smootherstep((t - closeFor) / FLY);
                r.position.lerpVectors(trip.fromPos, trip.outPos, e);
                r.quaternion.slerpQuaternions(trip.fromQuat, trip.slotQuat, e);
            } else {
                const e = smootherstep((t - closeFor - FLY) / SLIDE);
                r.position.lerpVectors(trip.outPos, trip.slotPos, e);
                r.quaternion.copy(trip.slotQuat);
                if (e >= 1) {
                    world.setBookPhase(null);
                    resumeFromKey(); // we released the mouse when taking the book
                }
            }
        }
        // Turning the front half about the spine (y). A negative angle swings
        // its free edge toward you on the way, like opening a real book.
        h.rotation.y = -trip.angle;
    });

    const { depth: w, thickness: t } = size;
    return (
        <group ref={root} visible={false}>
            <mesh geometry={back} position={[w / 2, 0, -t / 4]}>
                <meshStandardMaterial map={texture} roughness={0.85} />
            </mesh>
            <group ref={hinge}>
                <mesh geometry={front} position={[w / 2, 0, t / 4]}>
                    <meshStandardMaterial map={texture} roughness={0.85} />
                </mesh>
            </group>
            {phase === 'open' && <Pages note={note} size={size} zoom={zoom} />}
        </group>
    );
}

/** The note on the open spread: title page on the left, the text on the right. */
function Pages({ note, size, zoom }: { note: Note; size: BookSize; zoom: number }) {
    const pxPerMetre = PAGE_PX / size.depth;
    const height = Math.round(size.height * pxPerMetre);

    const area = NOTE_AREAS[note.area];
    const updated = new Date(`${note.updated}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <Html
            transform
            // One CSS px = distanceFactor/400 world units (see SeatScreen).
            distanceFactor={400 / pxPerMetre}
            position-z={0.0015}
            zIndexRange={[10, 0]}
        >
            <div
                style={{ width: PAGE_PX * 2, height }}
                className="flex animate-[screen-on_0.3s_ease-out] overflow-hidden font-serif text-[#2a2622]"
            >
                {/* left page: what this book is */}
                <div
                    className="flex h-full w-1/2 flex-col overflow-y-auto px-9 py-8"
                    // the fold: pages darken toward the spine
                    style={{ background: 'linear-gradient(to right, #f4eddd 78%, #ddd2bb)' }}
                >
                    <div className="flex min-h-full flex-col gap-4" style={{ zoom }}>
                        <p
                            className="font-mono text-xs uppercase tracking-[0.18em]"
                            style={{ color: area.color }}
                        >
                            {NOTE_KINDS[note.kind]} · {area.label}
                        </p>
                        <h2 className="text-3xl font-semibold leading-tight">
                            {note.title.replace(/^(Case|TIL): /, '')}
                        </h2>
                        <p className="text-lg italic leading-snug text-[#5b544b]">{note.summary}</p>
                        <p className="mt-auto font-mono text-xs text-[#8a8173]">
                            Updated {updated} · Esc · put back
                        </p>
                    </div>
                </div>
                {/* right page: the note itself */}
                <div
                    className="h-full w-1/2 overflow-y-auto overscroll-contain px-9 py-8"
                    style={{ background: 'linear-gradient(to left, #f4eddd 78%, #ddd2bb)' }}
                >
                    <div
                        className="book-prose"
                        style={{ zoom }}
                        // Our own markdown, rendered at build time (see content/notes.ts).
                        dangerouslySetInnerHTML={{ __html: note.html }}
                    />
                </div>
            </div>
        </Html>
    );
}
