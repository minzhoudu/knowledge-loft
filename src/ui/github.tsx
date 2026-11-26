'use client';

import { useEffect } from 'react';
import { useWorld } from '@/store/world';
import { timeAgo, type GithubRepo } from '@/world/github/types';

const REFRESH_MS = 60 * 60 * 1000; // matches the server cache: GitHub data is refreshed hourly

/** Keeps the store's GitHub data fresh. Mount once (in the HUD). */
export function useGithubFeed() {
    const setGithub = useWorld((s) => s.setGithub);
    useEffect(() => {
        let alive = true;
        const load = () =>
            fetch('/api/github')
                .then((r) => (r.ok ? r.json() : null))
                .then((g) => alive && setGithub(g))
                .catch(() => {}); // offline: keep whatever we had
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [setGithub]);
}

/** The whole wall: totals, profile link and the latest repos. */
export function GithubPanel() {
    const github = useWorld((s) => s.github);
    if (!github) return <p className="text-muted">GitHub is unavailable right now.</p>;
    return (
        <div className="flex flex-col gap-4">
            <p className="leading-relaxed">
                {github.calendar ? (
                    <>
                        <span className="font-semibold tabular-nums">
                            {github.calendar.total.toLocaleString('en')}
                        </span>{' '}
                        contributions in the last year.
                    </>
                ) : (
                    'Latest public repositories.'
                )}{' '}
                <a
                    className="text-accent underline-offset-4 hover:underline"
                    href={github.url}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    @{github.login} on GitHub
                </a>
            </p>
            <ul className="flex flex-col gap-3">
                {github.repos.map((r) => (
                    <li key={r.name}>
                        <RepoSummary repo={r} />
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted">Updated {timeAgo(github.fetchedAt)}.</p>
        </div>
    );
}

export function RepoPanel({ name }: { name: string }) {
    const repo = useWorld((s) => s.github?.repos.find((r) => r.name === name));
    if (!repo) return <p className="text-muted">This repository isn&apos;t on the wall anymore.</p>;
    return <RepoSummary repo={repo} linkText="Open on GitHub" />;
}

/** One repo: linked name (or `linkText`), description, language, stars, last push. */
function RepoSummary({ repo, linkText }: { repo: GithubRepo; linkText?: string }) {
    return (
        <div className="flex flex-col gap-1">
            <a
                className="font-semibold text-accent underline-offset-4 hover:underline"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
            >
                {linkText ?? repo.name}
            </a>
            {repo.description && <p className="leading-relaxed">{repo.description}</p>}
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
                {repo.language && (
                    <span className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block size-2.5 rounded-full"
                            style={{ background: repo.languageColor ?? 'currentColor' }}
                        />
                        {repo.language}
                    </span>
                )}
                {repo.stars > 0 && <span>★ {repo.stars}</span>}
                <span>updated {timeAgo(repo.pushedAt)}</span>
            </p>
        </div>
    );
}
