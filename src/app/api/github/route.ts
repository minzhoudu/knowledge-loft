import { cacheLife } from 'next/cache';
import { about } from '@/content';
import type { GithubData, GithubRepo } from '@/world/github/types';

/**
 * GET /api/github: your contribution calendar and latest public repos, for
 * the GitHub wall.
 *
 * Same idea as /api/weather: one cached server request serves every
 * visitor. GitHub allows unauthenticated clients only 60 requests an hour
 * per IP, so calling it from each visitor's browser would run dry fast; here
 * it's asked at most about once an hour.
 *
 * With GITHUB_TOKEN set (in .env.local; never committed) it uses GitHub's
 * GraphQL API, the only official source of the contribution calendar.
 * Without one it falls back to the public REST API: repos only.
 *
 * The token stays on the server: it's read here, in a route handler, and
 * never sent to the browser.
 */
export async function GET() {
    return Response.json(await getGithub());
}

const REPO_COUNT = 6;
const HEADERS = { 'User-Agent': 'knowledge-loft', Accept: 'application/vnd.github+json' };

async function getGithub(): Promise<GithubData | null> {
    'use cache';
    cacheLife({ stale: 600, revalidate: 3600, expire: 86_400 });

    const login = about.github;
    if (!login) return null;
    const token = process.env.GITHUB_TOKEN;
    try {
        return (token && (await fromGraphql(login, token))) || (await fromRest(login));
    } catch {
        return null; // GitHub down or rate-limited: the wall shows its empty state
    }
}

const QUERY = /* GraphQL */ `
    query ($login: String!) {
        user(login: $login) {
            url
            contributionsCollection {
                contributionCalendar {
                    totalContributions
                    weeks {
                        contributionDays {
                            date
                            contributionCount
                        }
                    }
                }
            }
            repositories(
                first: 12
                privacy: PUBLIC
                isFork: false
                ownerAffiliations: OWNER
                orderBy: { field: PUSHED_AT, direction: DESC }
            ) {
                nodes {
                    name
                    description
                    url
                    stargazerCount
                    pushedAt
                    primaryLanguage {
                        name
                        color
                    }
                }
            }
        }
    }
`;

type GraphqlUser = {
    url: string;
    contributionsCollection: {
        contributionCalendar: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
    };
    repositories: {
        nodes: {
            name: string;
            description: string | null;
            url: string;
            stargazerCount: number;
            pushedAt: string;
            primaryLanguage: { name: string; color: string | null } | null;
        }[];
    };
};

async function fromGraphql(login: string, token: string): Promise<GithubData | null> {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...HEADERS, Authorization: `bearer ${token}` },
        body: JSON.stringify({ query: QUERY, variables: { login } }),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null; // bad or expired token: fall back to REST
    const json = (await res.json()) as { data?: { user: GraphqlUser | null } };
    const user = json.data?.user;
    if (!user) return null;
    const calendar = user.contributionsCollection.contributionCalendar;
    return {
        login,
        url: user.url,
        calendar: {
            total: calendar.totalContributions,
            days: calendar.weeks.flatMap((w) =>
                w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
            ),
        },
        repos: pickRepos(
            user.repositories.nodes.map((r) => ({
                name: r.name,
                description: r.description,
                url: r.url,
                language: r.primaryLanguage?.name ?? null,
                languageColor: r.primaryLanguage?.color ?? null,
                stars: r.stargazerCount,
                pushedAt: r.pushedAt,
            })),
            login,
        ),
        fetchedAt: new Date().toISOString(),
    };
}

type RestRepo = {
    name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    pushed_at: string;
    fork: boolean;
};

/** The REST API has no language colours; these are GitHub's own for common ones. */
const LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572a5',
    Go: '#00add8',
    Kotlin: '#a97bff',
    PHP: '#4f5d95',
    Vue: '#41b883',
    HTML: '#e34c26',
    CSS: '#563d7c',
};

async function fromRest(login: string): Promise<GithubData | null> {
    const res = await fetch(
        `https://api.github.com/users/${login}/repos?sort=pushed&per_page=12&type=owner`,
        { headers: HEADERS, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const repos = (await res.json()) as RestRepo[];
    return {
        login,
        url: `https://github.com/${login}`,
        calendar: null,
        repos: pickRepos(
            repos
                .filter((r) => !r.fork)
                .map((r) => ({
                    name: r.name,
                    description: r.description,
                    url: r.html_url,
                    language: r.language,
                    languageColor: r.language ? (LANGUAGE_COLORS[r.language] ?? null) : null,
                    stars: r.stargazers_count,
                    pushedAt: r.pushed_at,
                })),
            login,
        ),
        fetchedAt: new Date().toISOString(),
    };
}

/** Latest repos, minus the profile README repo (named after the user). */
function pickRepos(repos: GithubRepo[], login: string) {
    return repos.filter((r) => r.name.toLowerCase() !== login.toLowerCase()).slice(0, REPO_COUNT);
}
