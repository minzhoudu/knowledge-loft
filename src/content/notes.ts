import { Marked } from 'marked';
import { NOTE_KINDS, NoteMetaSchema, type NoteKind } from './schema';

/**
 * The knowledge base behind the lobby bookshelf.
 *
 * Every markdown file in ./notes is a book. `import.meta.glob` is a bundler
 * feature (Turbopack implements it): it finds the files at build time and
 * imports each one. The `?raw` query plus the `*.md` rule in next.config.ts
 * make each import the file's text instead of a module, and `eager` inlines
 * them all now rather than loading on demand. So adding a book is adding a
 * file: no list to update, and no fetching at runtime.
 *
 * Each file starts with frontmatter (simple `key: value` lines between two
 * `---` lines), checked against NoteMetaSchema, then the body in markdown.
 */
const files = import.meta.glob<string | { default: string }>('./notes/*.md', {
    query: '?raw',
    eager: true,
});

/**
 * Depending on the build, a text module comes through as the string itself
 * or wrapped as `{ default: string }` (`import: 'default'` broke the server
 * prerender in `next build`), so accept both.
 */
const textOf = (m: string | { default: string }) => (typeof m === 'string' ? m : m.default);

export type Note = ReturnType<typeof parseNote>;

const markdown = new Marked({ gfm: true });

function parseNote(path: string, text: string) {
    const slug = path.replace(/^.*\/(.+)\.md$/, '$1');
    const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error(`notes/${slug}.md: missing the --- frontmatter --- block`);

    const fields: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const m = line.match(/^(\w+):\s*(.*)$/);
        if (m) fields[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    const meta = NoteMetaSchema.safeParse(fields);
    if (!meta.success) {
        throw new Error(
            `notes/${slug}.md: ${meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        );
    }

    const body = match[2].trim();
    // The notes are ours (in the repo, rendered at build time), so injecting
    // their HTML is safe. Outside links open in a new tab.
    const html = (markdown.parse(body, { async: false }) as string).replace(
        /<a href="(https?:)/g,
        '<a target="_blank" rel="noopener noreferrer" href="$1',
    );
    // body: the markdown itself (what the AI kiosk reads); html: rendered, for the pages.
    return { slug, ...meta.data, html, body, words: body.split(/\s+/).length };
}

const KIND_ORDER = Object.keys(NOTE_KINDS) as NoteKind[];

/** All notes: field notes, then case files, then TILs; by area, then title, within each. */
export const notes = Object.entries(files)
    .map(([path, mod]) => parseNote(path, textOf(mod)))
    .sort(
        (a, b) =>
            KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
            a.area.localeCompare(b.area) ||
            a.title.localeCompare(b.title),
    );

export const noteBySlug = (slug: string) => notes.find((n) => n.slug === slug);
