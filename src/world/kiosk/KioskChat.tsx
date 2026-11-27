'use client';

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import type { KioskAction } from '@/ai/kiosk-tools';
import type { KioskEvent } from '@/app/api/ask/route';
import { about } from '@/content';
import { useWorld } from '@/store/world';
import { destinationFor } from './destinations';

/**
 * The kiosk's screen: a chat with the portfolio (see app/api/ask).
 *
 * Models are stateless, so the conversation lives here, in the browser, and
 * the last few turns go along with every question. It's kept in a small
 * store outside the component, so stepping back from the kiosk and returning
 * picks up where you left off.
 *
 * Answers stream in: the server sends the reply as it's written, and we read
 * the response body chunk by chunk (fetch's ReadableStream), appending each
 * piece to the last message. That's what makes it "type".
 */

type Message = { role: 'user' | 'assistant'; content: string };
type Status = 'idle' | 'thinking' | 'streaming' | 'offline';

const useChat = create<{
    messages: Message[];
    status: Status;
    set: (p: Partial<{ messages: Message[]; status: Status }>) => void;
}>((set) => ({ messages: [], status: 'idle', set }));

const SUGGESTIONS = [
    'What is he working on now?',
    'Has he led a team?',
    "What's his strongest project?",
    'Which technologies does he know best?',
];
/** How much of the conversation goes along with each question (the route caps it too). */
const HISTORY = 8;

const ERRORS: Record<string, string> = {
    'slow-down': "That's a lot of questions in a short time. Give me a few minutes and ask again.",
    busy: "I've had a busy day. Try again tomorrow, or have a look around the loft.",
};

export function KioskChat() {
    const { messages, status } = useChat();
    const [draft, setDraft] = useState('');
    const list = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const abort = useRef<AbortController | null>(null);
    const busy = status === 'thinking' || status === 'streaming';

    // Ready to type straight away (not on phones: that would pop the keyboard up).
    //
    // A focused text box makes the browser scroll its containers to bring it
    // into view, even ones that hide their overflow. Around this chat, those
    // are drei's wrappers that place the page on the 3D screen: scrolling one
    // throws the whole screen off into space. So: focus without scrolling, and
    // pin any container around the chat back to zero if something scrolls it
    // anyway (clicking into the box, typing). The message list itself scrolls.
    useEffect(() => {
        if (!window.matchMedia('(pointer: coarse)').matches) {
            input.current?.focus({ preventScroll: true });
        }
        const pin = (e: Event) => {
            const el = e.target;
            if (!(el instanceof HTMLElement) || el === list.current) return;
            if (!input.current || !el.contains(input.current)) return;
            el.scrollTop = 0;
            el.scrollLeft = 0;
        };
        document.addEventListener('scroll', pin, true); // capture: scroll events don't bubble
        return () => {
            document.removeEventListener('scroll', pin, true);
            abort.current?.abort(); // stepped away mid-answer: stop it
        };
    }, []);

    // Keep the newest line in view as answers grow.
    useEffect(() => {
        if (messages.length) list.current?.scrollTo({ top: list.current.scrollHeight });
    }, [messages]);

    async function ask(question: string) {
        const q = question.trim();
        if (!q || busy) return;
        setDraft('');
        const chat = useChat.getState();
        const history: Message[] = [...chat.messages, { role: 'user', content: q }];
        chat.set({
            messages: [...history, { role: 'assistant', content: '' }],
            status: 'thinking',
        });

        const reply = (content: string, status: Status = 'idle') =>
            useChat.getState().set({
                messages: [...history, { role: 'assistant', content }],
                status,
            });

        abort.current = new AbortController();
        try {
            const res = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history.slice(-HISTORY) }),
                signal: abort.current.signal,
            });
            if (!res.ok || !res.body) {
                const { error } = (await res.json().catch(() => ({}))) as { error?: string };
                if (error === 'offline') {
                    useChat.getState().set({ messages: chat.messages, status: 'offline' });
                    return;
                }
                reply(ERRORS[error ?? ''] ?? 'Something went wrong on my side. Please try again.');
                return;
            }
            // The stream is NDJSON: one event per line (see app/api/ask). Network
            // chunks don't respect lines, so keep any unfinished line for the next
            // chunk, and handle only the complete ones.
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let text = '';
            let pending = '';
            let trip: KioskAction | null = null;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                pending += decoder.decode(value, { stream: true });
                const lines = pending.split('\n');
                pending = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line) as KioskEvent;
                    if (event.type === 'text') text += event.text;
                    else {
                        trip = event.action;
                        text += '\n\n'; // what it says after the tool call starts a new paragraph
                    }
                }
                reply(text, 'streaming');
            }
            reply(text.trim() || "I don't have an answer to that one.");
            if (trip) takeTrip(trip);
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            reply("I couldn't reach my brain just now. Check your connection and try again.");
        }
    }

    if (status === 'offline') return <Offline />;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6">
                {messages.length === 0 ? (
                    <div className="flex flex-col gap-4">
                        <p className="font-display text-2xl font-bold">
                            Ask me about {about.name.split(' ')[0]}.
                        </p>
                        <p className="text-muted">
                            I know his career, projects, skills and the notes on the bookshelf.
                            I&apos;m an AI, so check anything important against his CV.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => ask(s)}
                                    className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {messages.map((m, i) =>
                            m.role === 'user' ? (
                                <p
                                    key={i}
                                    className="self-end rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-black"
                                >
                                    {m.content}
                                </p>
                            ) : (
                                <p key={i} className="whitespace-pre-wrap leading-relaxed">
                                    {m.content}
                                    {i === messages.length - 1 && busy && (
                                        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-accent align-middle" />
                                    )}
                                </p>
                            ),
                        )}
                    </div>
                )}
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void ask(draft);
                }}
                className="flex shrink-0 gap-2 border-t border-line px-6 py-4"
            >
                <input
                    ref={input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={500}
                    placeholder={busy ? 'Answering…' : 'Ask a question…'}
                    aria-label="Your question"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 outline-none placeholder:text-muted focus:border-accent"
                />
                <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-40"
                >
                    Ask
                </button>
            </form>
        </div>
    );
}

/** A beat to read the answer before the camera lifts off. */
const TRIP_DELAY_MS = 1800;

/**
 * Go where the kiosk offered: after a moment to read its answer, rise over
 * the loft and dive to the spot (the map view's trip, see MapCamera). Not if
 * the visitor has stepped back from the kiosk in the meantime.
 */
function takeTrip(action: KioskAction) {
    const to = destinationFor(action);
    if (!to) return;
    setTimeout(() => {
        const s = useWorld.getState();
        if (s.seat === 'lobby-kiosk' && s.seatPhase === 'seated') s.travel(to);
    }, TRIP_DELAY_MS);
}

/** No AI configured (no API key yet), or switched off: say so, and point elsewhere. */
function Offline() {
    return (
        <div className="flex flex-1 flex-col justify-center gap-4 px-8 py-6">
            <p className="font-display text-2xl font-bold">The kiosk is resting.</p>
            <p className="text-muted">
                Its AI isn&apos;t switched on right now. Everything it knows is around the loft, and
                on one page in the quick view.
            </p>
            <div className="flex flex-wrap gap-3">
                <a
                    href="/quick"
                    className="rounded-lg bg-accent px-4 py-2 font-semibold text-black"
                >
                    Open the quick view
                </a>
                <button
                    type="button"
                    onClick={() => useChat.getState().set({ status: 'idle' })}
                    className="rounded-lg border border-line px-4 py-2"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
