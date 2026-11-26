'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { NOTE_KINDS, notes } from '@/content';
import { useWorld } from '@/store/world';
import { Block } from '@/world/greybox/Block';
import { Interactable, useIsFocused } from '@/world/interaction/Interactable';
import { drawBook, shelfBookGeometry } from './book';
import { layoutShelf, type BookSlot } from './layout';

/**
 * The lobby bookshelf's books: the knowledge base, one book per note in
 * src/content/notes. Aim at one and it slides out a little; use it and it
 * comes to you and opens (CarriedBook).
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

/** How far a book slides out when you aim at it, in metres. */
const PEEK = 0.035;

export function Bookshelf({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {layout.books.map((slot) => (
                <Interactable
                    key={slot.note.slug}
                    id={`book:${slot.note.slug}`}
                    label={`${NOTE_KINDS[slot.note.kind]} · ${slot.note.title}`}
                    action={{ kind: 'book', book: slot.note.slug }}
                >
                    <ShelfBook slot={slot} />
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
        </group>
    );
}

function ShelfBook({ slot }: { slot: BookSlot }) {
    const { note, size, position } = slot;
    const focused = useIsFocused();
    const taken = useWorld((s) => s.book === note.slug);
    const group = useRef<Group>(null);

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
        if (!g) return;
        const target = position[2] + (focused ? PEEK : 0);
        g.position.z += (target - g.position.z) * (1 - Math.exp(-delta * 14));
    });

    return (
        <group ref={group} position={position}>
            <mesh geometry={geometry} visible={!taken} receiveShadow>
                <meshStandardMaterial
                    map={texture}
                    roughness={0.85}
                    emissive="#ffffff"
                    emissiveMap={texture}
                    emissiveIntensity={focused ? 0.22 : 0}
                />
            </mesh>
        </group>
    );
}
