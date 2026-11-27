import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { INSTRUCTIONS, portfolioDocument } from '@/ai/kiosk-prompt';

/**
 * POST /api/ask: the lobby kiosk's brain.
 *
 * The browser sends the conversation so far (models are stateless: every
 * request carries the whole history); this route adds the system prompt
 * and the portfolio, asks Claude, and streams the answer back as plain
 * text, piece by piece, so the kiosk can type it out as it arrives.
 *
 * The API key lives only here, on the server (ANTHROPIC_API_KEY, from
 * .env.local or the host's settings). A browser never sees it: anyone could
 * copy a key shipped to the browser and spend your money.
 */

const MODEL = 'claude-haiku-5-5';
/** Answers are a few sentences; this caps what a single reply can cost. */
const MAX_TOKENS = 600;

// The model's whole briefing, built once per server start. Kept identical
// between requests so prompt caching can reuse it (see below).
const PORTFOLIO = `<portfolio>\n${portfolioDocument()}\n</portfolio>`;

const Body = z.object({
    messages: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant']),
                content: z.string().trim().min(1).max(600),
            }),
        )
        .min(1)
        .max(12)
        .refine((m) => m[m.length - 1].role === 'user', 'The last message must be the question'),
});

export async function POST(request: Request) {
    if (!process.env.ANTHROPIC_API_KEY) {
        // Not configured (no key yet): the kiosk shows its "resting" state.
        return Response.json({ error: 'offline' }, { status: 503 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const limited = rateLimit(ip);
    if (limited) return Response.json({ error: limited }, { status: 429 });

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'bad-request' }, { status: 400 });

    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Haiku 5.5 thinks before answering by default. For short, grounded
        // answers that only adds waiting, so: no thinking, low effort.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        // Two system blocks: the rules, then the portfolio. The cache marker on
        // the second caches everything up to and including it. Requests within
        // five minutes of each other then pay ~a tenth of the price for those
        // tokens and start answering sooner; only the conversation is new.
        system: [
            { type: 'text', text: INSTRUCTIONS },
            { type: 'text', text: PORTFOLIO, cache_control: { type: 'ephemeral' } },
        ],
        messages: parsed.data.messages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                // Each text_delta event is a few characters of the answer: pass
                // them straight on, so the visitor sees it being written.
                for await (const event of stream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                        controller.enqueue(encoder.encode(event.delta.text));
                    }
                }
                const final = await stream.finalMessage();
                if (final.stop_reason === 'refusal') {
                    controller.enqueue(
                        encoder.encode(
                            "\n\nI can't help with that one. Ask me about Pavle's work, projects or skills.",
                        ),
                    );
                }
                if (process.env.NODE_ENV === 'development') {
                    // How caching is doing: the first request writes the cache, the next
                    // ones (within five minutes) read it.
                    const u = final.usage;
                    console.log(
                        `[ask] in ${u.input_tokens}, cache write ${u.cache_creation_input_tokens ?? 0}, cache read ${u.cache_read_input_tokens ?? 0}, out ${u.output_tokens}`,
                    );
                }
            } catch (error) {
                console.error('[ask]', error instanceof Error ? error.message : error);
                controller.enqueue(
                    encoder.encode(
                        '\n\nSorry, my connection dropped. Please try again in a moment.',
                    ),
                );
            } finally {
                controller.close();
            }
        },
        cancel() {
            stream.abort(); // the visitor walked away mid-answer: stop paying for it
        },
    });

    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}

/**
 * A small guard against someone scripting the kiosk and running up the bill:
 * at most LIMIT questions per visitor (by IP address) per WINDOW, and a cap
 * per day for everyone together.
 *
 * It's in-memory, so on a serverless host each running instance keeps its
 * own count: a soft limit. The hard one is the monthly spend limit you set
 * in the Anthropic Console. (For a strict, shared limit you'd keep the counts
 * in a store like Redis.)
 */
const LIMIT = 10;
const WINDOW_MS = 10 * 60_000;
const DAILY = 500;
const seen = new Map<string, number[]>();
const day = { start: 0, count: 0 };

function rateLimit(ip: string): string | null {
    const now = Date.now();
    if (now - day.start > 86_400_000) {
        day.start = now;
        day.count = 0;
        seen.clear();
    }
    if (day.count >= DAILY) return 'busy';
    const recent = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= LIMIT) return 'slow-down';
    recent.push(now);
    seen.set(ip, recent);
    day.count++;
    return null;
}
