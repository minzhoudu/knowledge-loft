import type { Metadata } from 'next';
import Link from 'next/link';
import { about } from '@/content';
import type { SectionId } from '@/store/world';
import { Section, SECTION_TITLES } from '@/ui/sections';

export const metadata: Metadata = {
    title: `${about.name} Â· Quick view`,
    description: about.headline,
};

const ORDER: SectionId[] = ['about', 'projects', 'career', 'hobbies'];

/**
 * The 2D quick view: same content as the 3D world, as a plain fast page.
 * It's a Server Component, so it's fully rendered HTML: good for search
 * engines, link previews, slow phones and anyone in a hurry.
 */
export default function QuickView() {
    return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-12 sm:px-6">
            <header className="flex flex-col gap-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Quick view</p>
                <h1 className="font-display text-4xl font-bold">{about.name}</h1>
                <p className="text-lg text-muted">{about.headline}</p>
                <Link href="/" className="text-accent underline-offset-4 hover:underline">
                    â† Walk through the 3D studio instead
                </Link>
            </header>
            {ORDER.map((id) => (
                <section key={id} className="flex flex-col gap-4 border-t border-line pt-6">
                    <h2 className="font-display text-2xl font-bold">{SECTION_TITLES[id]}</h2>
                    <Section id={id} />
                </section>
            ))}
        </main>
    );
}
