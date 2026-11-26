import { useWorld } from '@/store/world';
import { buildLayers, playDoor, type Layers } from './sounds';

/**
 * The audio engine: one Web Audio graph for the whole app.
 *
 * Web Audio works like a modular synth. You create nodes (sources, filters,
 * gains, panners) and patch them together; the browser runs the graph on a
 * separate real-time audio thread, so JavaScript only has to change knob
 * values (AudioParams) now and then, never produce samples itself.
 *
 *   sources ─► filters ─► gain (per sound) ─► master ─► compressor ─► speakers
 *
 * Everything here is synthesised from noise and oscillators (no audio files),
 * which keeps the download at zero bytes and lets every sound react
 * continuously to the weather, time and room.
 *
 * Browsers only allow audio to start from a user gesture (autoplay policy),
 * so the context is created in startAudio(), called by the Enter button.
 */

export type NoiseKind = 'white' | 'pink' | 'brown';

export type Engine = {
    ctx: AudioContext;
    /** Mute and pause-ducking. Everything goes through here. */
    master: GainNode;
    noise: Record<NoiseKind, AudioBuffer>;
    layers: Layers;
};

let engine: Engine | null = null;

/** The running engine, or null before the visitor's first click. */
export function getAudio() {
    return engine;
}

/** Create (first click) or resume the audio. Call from a click/tap handler. */
export function startAudio() {
    if (engine) {
        void engine.ctx.resume();
        return;
    }
    if (typeof AudioContext === 'undefined') return; // very old browser: just stay silent

    const ctx = new AudioContext({ latencyHint: 'playback' }); // bigger buffers: fewer glitches, latency doesn't matter for ambience
    // A gentle compressor as a safety net: if several loud things line up
    // (rain + footsteps + a door), it evens them out instead of clipping.
    const limiter = new DynamicsCompressorNode(ctx, {
        threshold: -14,
        knee: 12,
        ratio: 4,
        attack: 0.01,
        release: 0.3,
    });
    const master = new GainNode(ctx, { gain: 0 }); // fades in from silence
    master.connect(limiter).connect(ctx.destination);

    const partial = {
        ctx,
        master,
        noise: {
            white: makeNoise(ctx, 'white'),
            pink: makeNoise(ctx, 'pink'),
            brown: makeNoise(ctx, 'brown'),
        },
    };
    engine = { ...partial, layers: buildLayers(partial) };
    if (process.env.NODE_ENV === 'development') {
        (window as unknown as { __audio: Engine }).__audio = engine; // poke at it from the console
    }

    // Doors: play a sound whenever one changes state, wherever it was toggled from.
    useWorld.subscribe((s, prev) => {
        if (!engine || s.doors === prev.doors) return;
        for (const id of Object.keys(s.doors)) {
            if (!!s.doors[id] !== !!prev.doors[id]) playDoor(engine, id, !!s.doors[id]);
        }
    });

    // Stop the audio thread entirely in a background tab (saves battery).
    document.addEventListener('visibilitychange', () => {
        if (!engine) return;
        if (document.hidden) void engine.ctx.suspend();
        else void engine.ctx.resume();
    });
}

/**
 * A few seconds of noise, generated once and looped.
 *
 * - white: every frequency equally loud. Harsh (hiss); used for clicks and taps.
 * - pink: each octave equally loud, so it sounds "even" to us. Rain, air.
 * - brown: mostly low end, like a deep rumble. Wind, HVAC, distant traffic.
 *
 * Stereo with independent channels, so the sound feels wide instead of
 * coming from a point between your ears.
 */
function makeNoise(ctx: AudioContext, kind: NoiseKind, seconds = 6) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const fade = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const raw = new Float32Array(length + fade);
        // Pink: Paul Kellet's filter, a sum of leaky integrators approximating -3 dB/octave.
        let b0 = 0,
            b1 = 0,
            b2 = 0,
            b3 = 0,
            b4 = 0,
            b5 = 0,
            b6 = 0;
        let brown = 0;
        for (let i = 0; i < raw.length; i++) {
            const w = Math.random() * 2 - 1;
            if (kind === 'white') {
                raw[i] = w * 0.5;
            } else if (kind === 'pink') {
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.969 * b2 + w * 0.153852;
                b3 = 0.8665 * b3 + w * 0.3104856;
                b4 = 0.55 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.016898;
                raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                b6 = w * 0.115926;
            } else {
                // Brown: a random walk (integrated white noise), gently pulled back to 0.
                brown = (brown + 0.02 * w) / 1.02;
                raw[i] = brown * 3.5;
            }
        }
        // Make the loop seamless: crossfade the extra tail into the start, so
        // the jump from the last sample back to the first has no click.
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            if (i < fade) {
                const t = i / fade;
                data[i] = raw[i] * t + raw[length + i] * (1 - t);
            } else {
                data[i] = raw[i];
            }
        }
    }
    return buffer;
}

/**
 * Smoothly move an AudioParam toward a value. setTargetAtTime is an
 * exponential approach (like our `ease` in the render loop, but on the audio
 * thread), so changes never "zipper" or click. Skipped when the target
 * hasn't changed, so calling it every frame is cheap.
 */
const lastTarget = new WeakMap<AudioParam, number>();
export function glide(ctx: AudioContext, param: AudioParam, value: number, seconds = 0.3) {
    const last = lastTarget.get(param);
    if (last !== undefined && Math.abs(last - value) < 1e-4) return;
    lastTarget.set(param, value);
    // No cancelScheduledValues first: cancelling a running approach makes the
    // value snap back to where it started. A new setTargetAtTime simply takes
    // over from wherever the value currently is.
    param.setTargetAtTime(value, ctx.currentTime, seconds / 3); // ~95% there after `seconds`
}
