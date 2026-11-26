import type { Note, NoteKind } from '@/content';
import { bookSize, type BookSize } from './book';

/**
 * Where each book stands on the lobby's steel shelf, in the shelf's own
 * frame (origin on the floor at its centre, +z toward the room).
 *
 * The board heights and ends were measured from the model's geometry
 * (upward-facing surfaces). The two halves have different boards, split
 * by a post at x ≈ -0.11:
 *   left:  0.66 (top of the drawers), 1.32
 *   right: 0.66, 1.09, 1.75
 */
type Row = { id: string; y: number; x0: number; x1: number; clearance: number };

const ROWS: Row[] = [
    { id: 'left-eye', y: 1.32, x0: -1.1, x1: -0.16, clearance: 0.95 },
    { id: 'right-eye', y: 1.09, x0: -0.06, x1: 1.09, clearance: 0.64 },
    { id: 'right-top', y: 1.75, x0: -0.06, x1: 1.09, clearance: 0.53 },
    { id: 'left-low', y: 0.66, x0: -1.1, x1: -0.16, clearance: 0.64 },
    { id: 'right-low', y: 0.66, x0: -0.06, x1: 1.09, clearance: 0.41 },
];

/** Each kind's own row first; a full row overflows into the next free one. */
const HOME: Record<NoteKind, string> = { note: 'left-eye', case: 'right-eye', til: 'right-top' };

/** Spines line up this far behind the boards' front edge (z ≈ 0.33). */
const SPINE_Z = 0.29;
const GAP = 0.004;
const MARGIN = 0.05; // from the post where a row starts

export type BookSlot = {
    note: Note;
    size: BookSize;
    /** Centre of the book, shelf frame. */
    position: [number, number, number];
};

export type ShelfLayout = {
    books: BookSlot[];
    /** Where each used row's books end: a bookend goes there. */
    ends: { y: number; x: number }[];
};

export function layoutShelf(notes: Note[]): ShelfLayout {
    const cursor = new Map(ROWS.map((r) => [r.id, r.x0 + MARGIN]));
    const books: BookSlot[] = [];

    for (const note of notes) {
        const size = bookSize(note);
        const start = ROWS.findIndex((r) => r.id === HOME[note.kind]);
        const order = [...ROWS.slice(start), ...ROWS.slice(0, start)];
        const row = order.find(
            (r) =>
                r.clearance > size.height + 0.02 &&
                cursor.get(r.id)! + size.thickness <= r.x1 - 0.06, // room for the bookend
        );
        if (!row) continue; // shelf full: the quick view still lists every note
        const x = cursor.get(row.id)!;
        cursor.set(row.id, x + size.thickness + GAP);
        books.push({
            note,
            size,
            position: [
                x + size.thickness / 2,
                row.y + size.height / 2 + 0.001,
                SPINE_Z - size.depth / 2,
            ],
        });
    }

    const ends = ROWS.filter((r) => cursor.get(r.id)! > r.x0 + MARGIN).map((r) => ({
        y: r.y,
        x: cursor.get(r.id)! + 0.006,
    }));
    return { books, ends };
}
