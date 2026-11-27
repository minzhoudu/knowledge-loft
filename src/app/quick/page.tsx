import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    about,
    companies,
    currently,
    CURRENTLY_KINDS,
    formatRange,
    hobbies,
    NOTE_AREAS,
    NOTE_KINDS,
    notes,
    projects,
    SKILL_CATEGORIES,
    skillName,
    skills,
    skillUsage,
    type SkillCategory,
} from '@/content';
import { SKILL_COLORS } from '@/world/constellation/colors';
import { SHARE_ALT } from '../share';
import { SkyArt } from './SkyArt';

const title = `${about.name} · ${about.headline}`;
// Its own title and description when shared, with the site's preview image
// (a page's openGraph replaces the inherited one whole, image included).
const image = { url: '/opengraph-image', width: 1200, height: 630, alt: SHARE_ALT };
export const metadata: Metadata = {
    title,
    description: about.bio,
    openGraph: { type: 'profile', url: '/quick', title, description: about.bio, images: [image] },
    twitter: { card: 'summary_large_image', title, description: about.bio, images: [image] },
};

/**
 * The quick view: everything in the 3D studio, as one page you can read in
 * a minute, for whoever would rather not walk around (recruiters on a
 * phone, most of all).
 *
 * A Server Component with no client JavaScript of its own: plain HTML and
 * CSS, so it's fast on any phone, readable by search engines and link
 * previews, and printable. The content is the same as the 3D world's.
 */

const NAV = [
    { id: 'experience', label: 'Experience' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'now', label: 'Now' },
    { id: 'notes', label: 'Notes' },
    { id: 'life', label: 'Off the clock' },
];

const firstYear = Math.min(...companies.map((c) => Number(c.start.slice(0, 4))));
// "This year" comes from the content (when the Now board was last updated),
// not the clock: the page is prerendered once, and a clock read would make it
// change between renders, which Next.js (rightly) refuses to prerender.
const thisYear = Number(currently.updated.slice(0, 4));
const years = thisYear - firstYear;
const current = companies.find((c) => c.end === null && c.name !== 'Freelance') ?? companies[0];
// Featured work first, then newest first.
const orderedProjects = [...projects].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year,
);
const uses = (slug: string) => {
    const u = skillUsage(slug);
    return u.projects.length + u.companies.length;
};

export default function QuickView() {
    return (
        <div className="quick-page relative min-h-dvh overflow-x-clip">
            {/* a warm glow behind the top of the page */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(60rem_28rem_at_20%_-10%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)]"
            />
            <Header />
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 pb-24 sm:px-6 lg:gap-32">
                <Hero />
                <Experience />
                <Projects />
                <Skills />
                <Now />
                <Notes />
                <Life />
            </main>
            <Footer />
        </div>
    );
}

function Header() {
    return (
        <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
                <a href="#top" className="flex shrink-0 items-center gap-2 font-display font-bold">
                    <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm text-black">
                        {initials(about.name)}
                    </span>
                    <span className="hidden sm:inline">{about.name}</span>
                </a>
                <nav
                    aria-label="Sections"
                    className="no-scrollbar -mx-1 flex min-w-0 flex-1 overflow-x-auto"
                >
                    <ul className="flex items-center gap-1 px-1 lg:mx-auto">
                        {NAV.map((n) => (
                            <li key={n.id}>
                                <a
                                    href={`#${n.id}`}
                                    className="block whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-line hover:text-fg"
                                >
                                    {n.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
                <Link
                    href="/"
                    className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold transition hover:border-accent hover:text-accent md:flex"
                >
                    Enter 3D <span aria-hidden>→</span>
                </Link>
            </div>
        </header>
    );
}

function Hero() {
    return (
        <section
            id="top"
            className="grid items-center gap-10 pt-12 sm:pt-16 lg:grid-cols-[1.2fr_1fr] lg:gap-14 lg:pt-24"
        >
            <div className="flex flex-col gap-6">
                <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                    <span className="size-2 rounded-full bg-accent" />
                    {about.location}
                </p>
                <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                    {about.name}
                </h1>
                <p className="text-xl font-medium text-accent sm:text-2xl">{about.headline}</p>
                <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                    {about.bio}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                    {about.cv && (
                        <a
                            href={about.cv}
                            download={`${about.name} CV.pdf`}
                            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-black shadow-[0_8px_24px_-10px_var(--accent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            Download CV <span aria-hidden>↓</span>
                        </a>
                    )}
                    {about.links.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-4 py-3 font-semibold transition hover:border-accent hover:text-accent"
                        >
                            {l.label}{' '}
                            <span aria-hidden className="text-muted">
                                ↗
                            </span>
                        </a>
                    ))}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
                    <Fact
                        label="Building since"
                        value={String(firstYear)}
                        note={`${years}+ years`}
                    />
                    <Fact label="Now" value={current.name} note={current.role.split(' · ')[0]} />
                    <Fact label="Projects" value={String(projects.length)} note="shipped & shown" />
                    <Fact
                        label="Skills"
                        value={String(skills.length)}
                        note={`across ${Object.keys(SKILL_CATEGORIES).length} areas`}
                    />
                </dl>
            </div>

            {/* The constellation, as a window onto the 3D world. */}
            <Link
                href="/"
                className="group relative block aspect-square overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_90%_at_50%_0%,#1f2236,#0b0c12_70%)] shadow-2xl shadow-black/30 sm:aspect-[16/11] lg:aspect-[4/5]"
            >
                <div className="absolute inset-0 p-4 transition duration-700 group-hover:scale-[1.04]">
                    <SkyArt />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16 text-[#ece8e2]">
                    <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                            Skill constellation
                        </p>
                        <p className="mt-1 text-sm text-white/85">
                            Every skill, linked to the ones it was used with. Step inside it in the
                            3D studio.
                        </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold backdrop-blur transition group-hover:bg-accent group-hover:text-black">
                        Enter 3D →
                    </span>
                </div>
            </Link>
        </section>
    );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="flex flex-col gap-0.5 bg-card p-4">
            <dt className="font-mono text-[11px] uppercase tracking-widest text-muted">{label}</dt>
            <dd className="truncate font-display text-xl font-bold">{value}</dd>
            <dd className="truncate text-xs text-muted">{note}</dd>
        </div>
    );
}

/** A section with a numbered eyebrow and a big title. */
function Block({
    id,
    index,
    title,
    intro,
    children,
}: {
    id: string;
    index: number;
    title: string;
    intro?: string;
    children: ReactNode;
}) {
    return (
        <section id={id} className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                    {String(index).padStart(2, '0')} / {title}
                </p>
                <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                    {title}
                </h2>
                {intro && <p className="max-w-2xl text-muted">{intro}</p>}
            </div>
            {children}
        </section>
    );
}

function Experience() {
    return (
        <Block id="experience" index={1} title="Experience">
            <ol className="relative flex flex-col gap-10 border-l border-line pl-6 sm:pl-0 sm:border-0">
                {companies.map((c, i) => (
                    <li
                        key={`${c.slug}-${c.start}`}
                        className="relative grid gap-2 sm:grid-cols-[11rem_1fr] sm:gap-8"
                    >
                        {/* the timeline: a line down the left (phones) or between the columns */}
                        <span
                            aria-hidden
                            className={`absolute top-1.5 -left-[1.875rem] size-3 rounded-full border-2 border-background sm:left-[11.6rem] ${
                                c.end === null
                                    ? 'bg-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_25%,transparent)]'
                                    : 'bg-muted'
                            }`}
                        />
                        <span
                            aria-hidden
                            className={`absolute top-0 left-[12rem] hidden w-px bg-line sm:block ${
                                i < companies.length - 1 ? '-bottom-10' : 'bottom-0'
                            }`}
                        />
                        <p className="font-mono text-sm text-muted tabular-nums sm:pt-0.5 sm:text-right">
                            {formatRange(c.start, c.end)}
                        </p>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-bold leading-snug">
                                {c.role}{' '}
                                <span className="font-semibold text-accent">· {c.name}</span>
                            </h3>
                            <p className="max-w-2xl leading-relaxed text-muted">{c.summary}</p>
                            {c.skills.length > 0 && <Tags items={c.skills} />}
                        </div>
                    </li>
                ))}
            </ol>
        </Block>
    );
}

function Projects() {
    return (
        <Block
            id="projects"
            index={2}
            title="Projects"
            intro="Products I built or led, the latest first."
        >
            <ul className="grid gap-4 md:grid-cols-2">
                {orderedProjects.map((p) => (
                    <li
                        key={p.slug}
                        className={`group flex flex-col gap-4 rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5 ${
                            p.featured ? 'border-accent/50 md:col-span-2 md:p-8' : 'border-line'
                        }`}
                    >
                        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
                            <span className="tabular-nums">{p.year}</span>
                            {p.featured && (
                                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-black">
                                    Featured
                                </span>
                            )}
                        </div>
                        <h3
                            className={`font-display font-extrabold tracking-tight ${p.featured ? 'text-3xl' : 'text-xl'}`}
                        >
                            {p.title}
                        </h3>
                        <p
                            className={`leading-relaxed text-muted ${p.featured ? 'max-w-3xl text-lg' : ''}`}
                        >
                            {p.summary}
                        </p>
                        <div className="mt-auto flex flex-col gap-4">
                            {p.skills.length > 0 && <Tags items={p.skills} />}
                            {p.links.length > 0 && (
                                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                                    {p.links.map((l) => (
                                        <li key={l.href}>
                                            <a
                                                href={l.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-accent underline-offset-4 hover:underline"
                                            >
                                                {l.label} ↗
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </Block>
    );
}

function Skills() {
    const groups = Object.keys(SKILL_CATEGORIES) as SkillCategory[];
    return (
        <Block
            id="skills"
            index={3}
            title="Skills"
            intro="Grouped by area. The highlighted ones I've used the most across projects and roles."
        >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((category, i) => {
                    const list = skills
                        .filter((s) => s.category === category)
                        .sort((a, b) => uses(b.slug) - uses(a.slug));
                    return (
                        <div
                            key={category}
                            // The odd one out at the end fills its row instead of sitting alone.
                            className={`flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 ${
                                i === groups.length - 1 ? 'sm:col-span-2 lg:col-span-3' : ''
                            }`}
                        >
                            <h3 className="flex items-center gap-2.5 font-semibold">
                                <span
                                    aria-hidden
                                    className="size-2.5 rounded-full"
                                    style={{
                                        background: SKILL_COLORS[category],
                                        boxShadow: `0 0 10px ${SKILL_COLORS[category]}`,
                                    }}
                                />
                                {SKILL_CATEGORIES[category]}
                            </h3>
                            <ul className="flex flex-wrap gap-1.5">
                                {list.map((s) => (
                                    <li
                                        key={s.slug}
                                        className={`rounded-full px-2.5 py-1 text-sm ${
                                            uses(s.slug) >= 3
                                                ? 'bg-fg font-semibold text-background'
                                                : 'border border-line text-muted'
                                        }`}
                                    >
                                        {s.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Block>
    );
}

function Now() {
    const updated = new Date(`${currently.updated}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return (
        <Block id="now" index={4} title="Right now" intro={`What I'm up to. Updated ${updated}.`}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {currently.items.map((item) => (
                    <li
                        key={`${item.kind}:${item.title}`}
                        className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5"
                    >
                        <p className="font-mono text-xs uppercase tracking-widest text-accent">
                            {CURRENTLY_KINDS[item.kind]}
                        </p>
                        <p className="font-semibold">{item.title}</p>
                        {item.detail && (
                            <p className="text-sm leading-relaxed text-muted">{item.detail}</p>
                        )}
                        {item.link && (
                            <a
                                href={item.link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-auto text-sm font-semibold text-accent underline-offset-4 hover:underline"
                            >
                                {item.link.label} ↗
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        </Block>
    );
}

function Notes() {
    return (
        <Block
            id="notes"
            index={5}
            title="Field notes"
            intro="The books on the lobby shelf: what I know, problems I've solved, and things I learned along the way. Open one to read it."
        >
            <ul className="grid items-start gap-3 md:grid-cols-2">
                {notes.map((note) => (
                    <li key={note.slug}>
                        <details className="group rounded-2xl border border-line bg-card p-5 open:border-accent/50">
                            <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
                                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <span
                                        className="font-mono text-[11px] uppercase tracking-widest"
                                        style={{ color: NOTE_AREAS[note.area].color }}
                                    >
                                        {NOTE_KINDS[note.kind]} · {NOTE_AREAS[note.area].label}
                                    </span>
                                    <span className="font-semibold group-open:text-accent">
                                        {note.title}
                                    </span>
                                    <span className="text-sm text-muted">{note.summary}</span>
                                </span>
                                <span
                                    aria-hidden
                                    className="mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-line text-muted transition group-open:rotate-45 group-open:border-accent group-open:text-accent"
                                >
                                    +
                                </span>
                            </summary>
                            <div
                                className="book-prose mt-4 border-t border-line pt-4 text-[15px]"
                                // Our own markdown, rendered at build time (content/notes.ts).
                                dangerouslySetInnerHTML={{ __html: note.html }}
                            />
                        </details>
                    </li>
                ))}
            </ul>
        </Block>
    );
}

function Life() {
    return (
        <Block id="life" index={6} title="Off the clock">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {hobbies.map((h) => (
                    <li
                        key={h.slug}
                        className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5"
                    >
                        <p className="font-semibold">{h.name}</p>
                        <p className="text-sm leading-relaxed text-muted">{h.summary}</p>
                    </li>
                ))}
            </ul>
        </Block>
    );
}

function Footer() {
    return (
        <footer className="border-t border-line">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6">
                <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#2a2340,#0b0c12_65%)] p-8 text-[#ece8e2] sm:p-12">
                    <div
                        aria-hidden
                        className="absolute inset-y-0 right-0 hidden w-1/2 opacity-60 md:block"
                    >
                        <SkyArt />
                    </div>
                    <div className="relative flex max-w-lg flex-col gap-4">
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e0a56a]">
                            The long version
                        </p>
                        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                            Rather walk through it?
                        </h2>
                        <p className="text-white/75">
                            The same story as a 3D studio loft you can explore: the real sun and
                            weather of Novi Sad, a bookshelf of notes, a career corridor, and an
                            arcade machine in the lobby.
                        </p>
                        <Link
                            href="/"
                            className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-[#e0a56a] px-5 py-3 font-semibold text-black transition hover:brightness-110"
                        >
                            Enter the 3D studio <span aria-hidden>→</span>
                        </Link>
                    </div>
                </div>
                <div className="flex flex-col justify-between gap-4 text-sm text-muted sm:flex-row sm:items-center">
                    <p>
                        © {thisYear} {about.name} · {about.location}
                    </p>
                    <ul className="flex flex-wrap gap-x-5 gap-y-2">
                        {about.cv && (
                            <li>
                                <a
                                    href={about.cv}
                                    download={`${about.name} CV.pdf`}
                                    className="hover:text-accent"
                                >
                                    CV
                                </a>
                            </li>
                        )}
                        {about.links.map((l) => (
                            <li key={l.href}>
                                <a
                                    href={l.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-accent"
                                >
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </footer>
    );
}

function Tags({ items }: { items: string[] }) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {items.map((s) => (
                <li
                    key={s}
                    className="rounded-md bg-line/60 px-2 py-0.5 font-mono text-xs text-muted"
                >
                    {skillName(s)}
                </li>
            ))}
        </ul>
    );
}

function initials(name: string) {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2);
}
