import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { INSTRUCTIONS, portfolioDocument } from '@/ai/kiosk-prompt';
import { toAction, TOOLS, type KioskAction } from '@/ai/kiosk-tools';

/**
 * POST /api/ask: the lobby kiosk's brain.
 *
 * The browser sends the conversation so far (models are stateless: every
 * request carries the whole history); this route adds the system prompt,
 * the portfolio and the tools, asks Claude, and streams the answer back
 * piece by piece, so the kiosk can type it out as it arrives.
 *
 * The response is NDJSON: one small JSON object per line, either a piece of
 * text ({"type":"text","text":"..."}) or an action for the browser
 * ({"type":"go","action":{...}}, from a tool call). Plain text couldn't
 * carry both; a line per message is the simplest stream that can.
 *
 * The API key lives only here, on the server (ANTHROPIC_API_KEY, from
 * .env.local or the host's settings). A browser never sees it: anyone could
 * copy a key shipped to the browser and spend your money.
 */

const MODEL = 'claude-haiku-5-5';
/** Answers are a few sentences; this caps what a single reply can cost. */
const MAX_TOKENS = 600;
/** A tool call, then the sentence after it. Never more round trips than that. */
const MAX_ROUNDS = 2;

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

/** One line of the response stream. */
export type KioskEvent = { type: 'text'; text: string } | { type: 'go'; action: KioskAction };

const REFUSED = "\n\nI can't help with that one. Ask me about Pavle's work, projects or skills.";
const DROPPED = '\n\nSorry, my connection dropped. Please try again in a moment.';
const DONE =
    'Done: the visitor is being taken there now. Close with one short sentence about what they will see. Do not call more tools.';

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
    const encoder = new TextEncoder();
    let current: ReturnType<typeof client.messages.stream> | null = null;

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: KioskEvent) =>
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            // The conversation for this request grows by a turn per tool call:
            // the model's tool_use, then our tool_result.
            const messages: Anthropic.MessageParam[] = [...parsed.data.messages];
            let travelled = false;
            try {
                for (let round = 0; round < MAX_ROUNDS; round++) {
                    current = client.messages.stream({
                        model: MODEL,
                        max_tokens: MAX_TOKENS,
                        // Haiku 5.5 thinks before answering by default. For short,
                        // grounded answers that only adds waiting: no thinking, low effort.
                        thinking: { type: 'disabled' },
                        output_config: { effort: 'low' },
                        // Prompt order is tools, then system, then messages. The cache
                        // marker on the last system block caches everything up to it
                        // (tools, rules, portfolio): requests within five minutes pay a
                        // fraction of the price for those tokens and start sooner.
                        tools: TOOLS,
                        system: [
                            { type: 'text', text: INSTRUCTIONS },
                            {
                                type: 'text',
                                text: PORTFOLIO,
                                cache_control: { type: 'ephemeral' },
                            },
                        ],
                        messages,
                    });

                    // Each text_delta is a few characters of the answer: pass them
                    // straight on, so the visitor sees it being written.
                    for await (const event of current) {
                        if (
                            event.type === 'content_block_delta' &&
                            event.delta.type === 'text_delta'
                        ) {
                            send({ type: 'text', text: event.delta.text });
                        }
                    }
                    const final = await current.finalMessage();
                    logUsage(final.usage);

                    if (final.stop_reason === 'refusal') {
                        // Never act on a refused turn: it may have been cut off mid-tool-call.
                        send({ type: 'text', text: REFUSED });
                        break;
                    }
                    if (final.stop_reason !== 'tool_use') break; // a plain answer: done

                    // The model asked for a tool. Check each call's input; the first
                    // valid trip goes to the browser. Every call gets a result, so
                    // the model can finish its reply knowing what happened.
                    const results: Anthropic.ToolResultBlockParam[] = [];
                    for (const block of final.content) {
                        if (block.type !== 'tool_use') continue;
                        const action = toAction(block.name, block.input);
                        if (action && !travelled) {
                            send({ type: 'go', action });
                            travelled = true;
                            results.push({
                                type: 'tool_result',
                                tool_use_id: block.id,
                                content: DONE,
                            });
                        } else {
                            results.push({
                                type: 'tool_result',
                                tool_use_id: block.id,
                                is_error: true,
                                content: action
                                    ? 'Only one trip at a time; this one was not taken.'
                                    : 'No such place. Use one of the listed values.',
                            });
                        }
                    }
                    messages.push(
                        { role: 'assistant', content: final.content },
                        { role: 'user', content: results },
                    );
                }
            } catch (error) {
                console.error('[ask]', error instanceof Error ? error.message : error);
                send({ type: 'text', text: DROPPED });
            } finally {
                controller.close();
            }
        },
        cancel() {
            current?.abort(); // the visitor walked away mid-answer: stop paying for it
        },
    });

    return new Response(body, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

/** In development: how caching is doing (the first request writes it, the next ones read it). */
function logUsage(u: Anthropic.Usage) {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(
        `[ask] in ${u.input_tokens}, cache write ${u.cache_creation_input_tokens ?? 0}, cache read ${u.cache_read_input_tokens ?? 0}, out ${u.output_tokens}`,
    );
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
