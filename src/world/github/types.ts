/** What /api/github returns, and helpers shared by the wall and the panels. */

export type GithubDay = { date: string; count: number };

export type GithubRepo = {
    name: string;
    description: string | null;
    url: string;
    language: string | null;
    /** The language's colour on GitHub, e.g. "#3178c6" for TypeScript. */
    languageColor: string | null;
    stars: number;
    pushedAt: string;
};

export type GithubData = {
    login: string;
    url: string;
    /**
     * The contribution calendar: the last year, one entry per day, oldest
     * first. null without a token (GitHub only serves it via its GraphQL API).
     */
    calendar: { total: number; days: GithubDay[] } | null;
    repos: GithubRepo[];
    /** When the server fetched this (ISO), so the panel can say how fresh it is. */
    fetchedAt: string;
};

/**
 * GitHub-style intensity levels, 0..4. Like GitHub's own graph, levels are
 * relative to *your* busiest days (quartiles of the non-zero days), so a
 * quiet year still shows its shape instead of looking uniformly faint.
 */
export function contributionLevels(days: GithubDay[]) {
    const counts = days
        .map((d) => d.count)
        .filter((c) => c > 0)
        .sort((a, b) => a - b);
    const q = (p: number) => counts[Math.floor(p * (counts.length - 1))] ?? 0;
    const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
    return days.map((d) =>
        d.count === 0 ? 0 : d.count <= q1 ? 1 : d.count <= q2 ? 2 : d.count <= q3 ? 3 : 4,
    );
}

/** "today", "yesterday", "5 days ago", "3 months ago". */
export function timeAgo(iso: string, now = Date.now()) {
    const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 31) return `${days} days ago`;
    const months = Math.round(days / 30.4);
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    const years = Math.round(days / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
