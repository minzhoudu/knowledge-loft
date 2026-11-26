import { about, companies, formatRange, hobbies, projects } from '@/content';
import type { Panel, SectionId } from '@/store/world';

/**
 * Content sections shared by the 3D panels and the 2D quick view.
 * Pure components (no hooks), so they work on the server and in the client.
 */

export const SECTION_TITLES: Record<SectionId, string> = {
    about: 'About me',
    projects: 'Projects',
    career: 'Career',
    hobbies: 'Hobbies',
};

export function panelTitle(panel: Panel) {
    switch (panel.kind) {
        case 'section':
            return SECTION_TITLES[panel.id];
        case 'project':
            return projects.find((p) => p.slug === panel.slug)?.title ?? 'Project';
        case 'company':
            return companies.find((c) => c.slug === panel.slug)?.name ?? 'Company';
        case 'hobby':
            return hobbies.find((h) => h.slug === panel.slug)?.name ?? 'Hobby';
    }
}

export function PanelBody({ panel }: { panel: Panel }) {
    switch (panel.kind) {
        case 'section':
            return <Section id={panel.id} />;
        case 'project':
            return <ProjectDetail slug={panel.slug} />;
        case 'company':
            return <CompanyDetail slug={panel.slug} />;
        case 'hobby':
            return <HobbyDetail slug={panel.slug} />;
    }
}

function HobbyDetail({ slug }: { slug: string }) {
    const h = hobbies.find((x) => x.slug === slug);
    if (!h) return <p className="text-muted">This hobby no longer exists.</p>;
    return <p className="leading-relaxed">{h.summary}</p>;
}

function CompanyDetail({ slug }: { slug: string }) {
    const c = companies.find((x) => x.slug === slug);
    if (!c) return <p className="text-muted">This role no longer exists.</p>;
    return (
        <div className="flex flex-col gap-3">
            <p className="font-semibold">{c.role}</p>
            <p className="text-sm text-muted tabular-nums">{formatRange(c.start, c.end)}</p>
            <p className="leading-relaxed">{c.summary}</p>
            {c.skills.length > 0 && <Tags items={c.skills} />}
        </div>
    );
}

function ProjectDetail({ slug }: { slug: string }) {
    const p = projects.find((x) => x.slug === slug);
    if (!p) return <p className="text-muted">This project no longer exists.</p>;
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted tabular-nums">
                {p.year}
                {p.featured ? ' · Featured' : ''}
            </p>
            <p className="leading-relaxed">{p.summary}</p>
            {p.skills.length > 0 && <Tags items={p.skills} />}
            <LinkRow links={p.links} />
        </div>
    );
}

export function Section({ id }: { id: SectionId }) {
    switch (id) {
        case 'about':
            return <AboutSection />;
        case 'projects':
            return <ProjectsSection />;
        case 'career':
            return <CareerSection />;
        case 'hobbies':
            return <HobbiesSection />;
    }
}

function AboutSection() {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-lg font-semibold">{about.name}</p>
            <p className="text-muted">
                {about.headline}
                {about.location ? ` · ${about.location}` : ''}
            </p>
            <p className="leading-relaxed">{about.bio}</p>
            <LinkRow links={about.links} />
        </div>
    );
}

function ProjectsSection() {
    return (
        <ul className="flex flex-col gap-4">
            {projects.map((p) => (
                <li key={p.slug} className="flex flex-col gap-1">
                    <p className="font-semibold">
                        {p.title}{' '}
                        <span className="font-normal text-muted tabular-nums">· {p.year}</span>
                    </p>
                    <p className="leading-relaxed">{p.summary}</p>
                    {p.skills.length > 0 && <Tags items={p.skills} />}
                    <LinkRow links={p.links} />
                </li>
            ))}
        </ul>
    );
}

function CareerSection() {
    return (
        <ol className="flex flex-col gap-4">
            {companies.map((c) => (
                <li key={c.slug} className="flex flex-col gap-1">
                    <p className="font-semibold">
                        {c.role} · {c.name}
                    </p>
                    <p className="text-sm text-muted tabular-nums">{formatRange(c.start, c.end)}</p>
                    <p className="leading-relaxed">{c.summary}</p>
                    {c.skills.length > 0 && <Tags items={c.skills} />}
                </li>
            ))}
        </ol>
    );
}

function HobbiesSection() {
    return (
        <ul className="flex flex-col gap-3">
            {hobbies.map((h) => (
                <li key={h.slug}>
                    <p className="font-semibold">{h.name}</p>
                    <p className="leading-relaxed">{h.summary}</p>
                </li>
            ))}
        </ul>
    );
}

function Tags({ items }: { items: string[] }) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {items.map((s) => (
                <li
                    key={s}
                    className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted"
                >
                    {s}
                </li>
            ))}
        </ul>
    );
}

function LinkRow({ links }: { links: { label: string; href: string }[] }) {
    if (links.length === 0) return null;
    return (
        <ul className="flex flex-wrap gap-3">
            {links.map((l) => (
                <li key={l.href}>
                    <a
                        className="text-accent underline-offset-4 hover:underline"
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {l.label}
                    </a>
                </li>
            ))}
        </ul>
    );
}
