import { DOOR_POSITIONS, WINDOW_POSITIONS, type RoomId } from '@/world/rooms/zones';
import type { Engine, NoiseKind } from './engine';

/**
 * The sounds themselves, built from the engine's noise buffers and
 * oscillators. Two kinds:
 *
 * - Beds: always-running loops (room tone, rain, wind, crickets). Their
 *   volume knobs are turned up and down by the Ambience component.
 * - One-shots: short events scheduled on the audio clock (footsteps, doors,
 *   birdsong, clock ticks). Web Audio source nodes are single-use by
 *   design: create, start(time), and they clean themselves up when done.
 *
 * Shaping sound from noise is mostly filtering:
 * - lowpass keeps what's below a frequency (muffled, distant, through a wall),
 * - highpass keeps what's above (thin, hissy, close),
 * - bandpass keeps a band around a frequency (a "colour": rain hiss, a tick).
 */

type Base = Omit<Engine, 'layers'>;

export type Layers = {
    /** One bed per room; only the room you're in (and open neighbours) is audible. */
    rooms: Record<RoomId, GainNode>;
    outdoor: {
        /** How much of the outside reaches you (glass, walls, doors). */
        bus: GainNode;
        /** Glass and walls take the highs off; lower cutoff = farther inside. */
        muffle: BiquadFilterNode;
        rain: GainNode;
        wind: GainNode;
        birds: GainNode;
        crickets: GainNode;
    };
    pad: OscillatorNode[];
    /** When the next scheduled one-shot of each kind is due, in audio-clock seconds. */
    next: { tick: number; birds: number; chord: number };
    chord: number;
    tock: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Small node factories, so the graphs below read like patch notes.
function noise(e: Base, kind: NoiseKind, playbackRate = 1) {
    const buffer = e.noise[kind];
    const src = new AudioBufferSourceNode(e.ctx, { buffer, loop: true, playbackRate });
    src.start(0, Math.random() * buffer.duration); // random offset: two loops never line up
    return src;
}
const filter = (e: Base, type: BiquadFilterType, frequency: number, Q = 0.707) =>
    new BiquadFilterNode(e.ctx, { type, frequency, Q });
const amp = (e: Base, gain: number) => new GainNode(e.ctx, { gain });

/**
 * A low-frequency oscillator wired into a parameter. Connecting a signal to
 * an AudioParam *adds* it to the param's own value, so a 0.5 Hz LFO with
 * depth 200 into a 500 Hz filter sweeps it between 300 and 700 Hz.
 */
function lfo(
    e: Base,
    frequency: number,
    depth: number,
    target: AudioParam,
    type: OscillatorType = 'sine',
) {
    const o = new OscillatorNode(e.ctx, { frequency, type });
    o.connect(amp(e, depth)).connect(target);
    o.start();
}

/** A positioned point in the world; the browser does distance and direction for us. */
function panner(e: Base, [x, y, z]: [number, number, number], refDistance = 3) {
    return new PannerNode(e.ctx, {
        // HRTF: filters each ear the way a human head does, so you can hear
        // whether a sound is in front, behind, left or right (best on headphones).
        panningModel: 'HRTF',
        distanceModel: 'inverse', // volume = ref / distance, like real sound outdoors
        refDistance,
        rolloffFactor: 1,
        positionX: x,
        positionY: y,
        positionZ: z,
    });
}

export function buildLayers(e: Base): Layers {
    const rooms = {
        lobby: amp(e, 0),
        projects: amp(e, 0),
        career: amp(e, 0),
        hobbies: amp(e, 0),
    } satisfies Record<RoomId, GainNode>;
    for (const room of Object.values(rooms)) room.connect(e.master);

    // Lobby: ventilation. Deep rumble with a faint airy hiss on top.
    noise(e, 'brown')
        .connect(filter(e, 'lowpass', 320))
        .connect(amp(e, 0.16))
        .connect(rooms.lobby);
    noise(e, 'pink')
        .connect(filter(e, 'bandpass', 5000, 0.7))
        .connect(amp(e, 0.01))
        .connect(rooms.lobby);

    // Projects: a gallery with screens. Lower, darker air plus electrical
    // hum. Mains in Serbia is 50 Hz; transformers hum at twice that (100 Hz)
    // and its harmonics, which is where that "server room" tone comes from.
    noise(e, 'brown')
        .connect(filter(e, 'lowpass', 240))
        .connect(amp(e, 0.14))
        .connect(rooms.projects);
    const hum = amp(e, 0.006);
    hum.connect(rooms.projects);
    for (const [f, g] of [
        [100, 1],
        [200, 0.5],
        [300, 0.2],
    ]) {
        const o = new OscillatorNode(e.ctx, { frequency: f });
        o.connect(amp(e, g)).connect(hum);
        o.start();
    }
    lfo(e, 0.23, 0.002, hum.gain); // a slow waver, like a real transformer

    // Career: a quiet corridor. Thin air; a clock ticks (scheduled below).
    noise(e, 'pink')
        .connect(filter(e, 'lowpass', 650))
        .connect(amp(e, 0.08))
        .connect(rooms.career);

    // Hobbies: the lounge. A record playing: crackle plus a slow, soft chord pad.
    noise(e, 'brown')
        .connect(filter(e, 'lowpass', 380))
        .connect(amp(e, 0.1))
        .connect(rooms.hobbies);
    const crackle = new AudioBufferSourceNode(e.ctx, { buffer: makeCrackle(e.ctx), loop: true });
    crackle
        .connect(filter(e, 'highpass', 900))
        .connect(filter(e, 'lowpass', 6500))
        .connect(amp(e, 0.22))
        .connect(rooms.hobbies);
    crackle.start();
    const padBus = amp(e, 0.05);
    padBus.connect(filter(e, 'lowpass', 1100)).connect(rooms.hobbies);
    lfo(e, 0.11, 0.015, padBus.gain); // breathe
    const pad = CHORDS[0].map((frequency, i) => {
        const o = new OscillatorNode(e.ctx, { type: 'triangle', frequency, detune: (i - 1.5) * 4 });
        o.connect(amp(e, 0.25)).connect(padBus);
        o.start();
        return o;
    });

    // Outdoors: everything mixed, muffled by the glass, then heard from two
    // points just outside the south windows. Walk up to a window and it gets
    // louder; turn your back and it moves behind you.
    const mix = amp(e, 0.7); // two windows add up; keep the sum in check
    const muffle = filter(e, 'lowpass', 3500);
    const bus = amp(e, 1);
    mix.connect(muffle).connect(bus);
    for (const position of WINDOW_POSITIONS) bus.connect(panner(e, position, 3)).connect(e.master);

    // Rain: pink hiss (the drops) over a low body (the downpour as a whole).
    const rain = amp(e, 0);
    rain.connect(mix);
    noise(e, 'pink')
        .connect(filter(e, 'highpass', 600))
        .connect(filter(e, 'lowpass', 8000))
        .connect(amp(e, 0.9))
        .connect(rain);
    noise(e, 'brown')
        .connect(filter(e, 'lowpass', 160))
        .connect(amp(e, 0.4))
        .connect(rain);

    // Wind: brown noise through a band that slowly drifts (the "whoosh"
    // changes pitch), with slow swells in volume (gusts).
    const wind = amp(e, 0);
    wind.connect(mix);
    const band = filter(e, 'bandpass', 520, 1.1);
    const gusts = amp(e, 0.6);
    noise(e, 'brown', 0.9).connect(band).connect(gusts).connect(wind);
    lfo(e, 0.06, 300, band.frequency);
    lfo(e, 0.17, 0.35, gusts.gain);

    const birds = amp(e, 1);
    birds.connect(mix);

    // Crickets: a high tone switched on and off fast (the buzz, ~28 pulses a
    // second) and slow (the chirps). Each gain sits at 0.5 and a square LFO
    // adds ±0.5, so it flips between 0 and 1: amplitude modulation.
    const crickets = amp(e, 0);
    crickets.connect(mix);
    for (const [pitch, pulse, chirp] of [
        [4400, 28, 1.6],
        [4750, 31, 1.9],
    ]) {
        const tone = new OscillatorNode(e.ctx, { frequency: pitch });
        const buzz = amp(e, 0.5);
        const on = amp(e, 0.5);
        tone.connect(buzz).connect(on).connect(amp(e, 0.06)).connect(crickets);
        lfo(e, pulse, 0.5, buzz.gain, 'square');
        lfo(e, chirp, 0.5, on.gain, 'square');
        tone.start();
    }

    return {
        rooms,
        outdoor: { bus, muffle, rain, wind, birds, crickets },
        pad,
        next: { tick: 0, birds: e.ctx.currentTime + 2, chord: e.ctx.currentTime + CHORD_SECONDS },
        chord: 0,
        tock: false,
    };
}

/** Vinyl crackle: sparse random clicks of random size, with a little hiss. */
function makeCrackle(ctx: AudioContext, seconds = 8) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const clicksPerSecond = 22;
    let tail = 0;
    for (let i = 0; i < data.length; i++) {
        if (Math.random() < clicksPerSecond / ctx.sampleRate) {
            tail = Math.random() ** 3 * (Math.random() < 0.5 ? -1 : 1); // mostly tiny, a few pops
        }
        data[i] = tail + (Math.random() * 2 - 1) * 0.004;
        tail *= 0.55; // each click dies away within a few samples
    }
    return buffer;
}

// A slow four-chord loop for the lounge pad (Am7, Fmaj7, Cmaj7, G6), in Hz.
const CHORDS = [
    [110.0, 261.63, 329.63, 392.0],
    [87.31, 220.0, 261.63, 329.63],
    [130.81, 164.81, 196.0, 246.94],
    [98.0, 246.94, 293.66, 329.63],
];
const CHORD_SECONDS = 8;

/**
 * Schedule upcoming one-shots. Called every frame, it looks a little ahead
 * on the audio clock and books events at exact times, so their timing is
 * sample-accurate even if a frame is late (a lagging setTimeout would make
 * the clock tick unevenly).
 */
export function schedule(e: Engine, birdAmount: number) {
    const { ctx, layers: L } = e;
    const now = ctx.currentTime;

    // Clock in the career corridor: one tick per second, alternating tick/tock.
    if (L.next.tick < now) L.next.tick = Math.ceil(now);
    while (L.next.tick < now + 0.2) {
        tick(e, L.next.tick, (L.tock = !L.tock));
        L.next.tick += 1;
    }

    // Lounge pad: glide to the next chord.
    if (now > L.next.chord) {
        L.chord = (L.chord + 1) % CHORDS.length;
        L.pad.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[L.chord][i], now, 0.5));
        L.next.chord = now + CHORD_SECONDS;
    }

    // Birdsong: a phrase every few seconds, more often when there are more birds.
    if (now > L.next.birds) {
        if (birdAmount > 0.03) birdPhrase(e, now + 0.05, birdAmount);
        L.next.birds = now + rand(1.5, 6) / Math.max(birdAmount, 0.25);
    }
}

/** A short burst of noise (a hit: tick, click, tap) into `out`. */
function burst(
    e: Base,
    out: AudioNode,
    at: number,
    length: number,
    gain: number,
    f: BiquadFilterNode,
) {
    const src = new AudioBufferSourceNode(e.ctx, { buffer: e.noise.white });
    const env = amp(e, 0);
    // An envelope: jump up, then decay exponentially, like any struck object.
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(env).connect(out);
    src.start(at, Math.random() * 4, length + 0.02);
}

/** A falling tone with a decay: the "body" of a thump. */
function thump(
    e: Base,
    out: AudioNode,
    at: number,
    from: number,
    to: number,
    length: number,
    gain: number,
) {
    const o = new OscillatorNode(e.ctx, { frequency: from });
    o.frequency.exponentialRampToValueAtTime(to, at + length);
    const env = amp(e, 0);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    o.connect(env).connect(out);
    o.start(at);
    o.stop(at + length + 0.02);
}

function tick(e: Engine, at: number, tock: boolean) {
    burst(e, e.layers.rooms.career, at, 0.025, 0.35, filter(e, 'bandpass', tock ? 2300 : 3000, 9));
}

function birdPhrase(e: Engine, start: number, amount: number) {
    const out = e.layers.outdoor.birds;
    const base = rand(2300, 4200);
    const warble = Math.random() < 0.35; // two "species": chirpers and warblers
    let t = start;
    const notes = Math.round(rand(2, 7));
    for (let n = 0; n < notes; n++) {
        const length = warble ? rand(0.15, 0.3) : rand(0.05, 0.12);
        const f = base * rand(0.9, 1.15);
        const o = new OscillatorNode(e.ctx, { frequency: f });
        // A chirp is a fast pitch sweep up and back down.
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.45, t + length * 0.4);
        o.frequency.exponentialRampToValueAtTime(f * 0.85, t + length);
        if (warble) {
            // Frequency modulation: a second oscillator wobbling the first's pitch.
            const m = new OscillatorNode(e.ctx, { frequency: rand(25, 40) });
            m.connect(amp(e, f * 0.08)).connect(o.frequency);
            m.start(t);
            m.stop(t + length + 0.02);
        }
        const env = amp(e, 0);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.06 * Math.min(1, amount + 0.3), t + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, t + length);
        o.connect(env).connect(out);
        o.start(t);
        o.stop(t + length + 0.02);
        t += length + rand(0.04, 0.18);
    }
}

/** One footstep: a soft scuff (filtered noise) plus a low heel thump. */
export function footstep(e: Engine, loud: number) {
    const at = e.ctx.currentTime + 0.01;
    burst(e, e.master, at, 0.09, 0.15 * loud, filter(e, 'lowpass', rand(500, 1100)));
    thump(e, e.master, at, rand(85, 105), 45, 0.09, 0.22 * loud);
}

/**
 * A door swinging (a filtered-noise swoosh whose band sweeps down), with a
 * latch click when it opens, and a thud plus click as it shuts. Played at the
 * door's position, so you hear where it is.
 */
export function playDoor(e: Engine, id: string, open: boolean) {
    const position = DOOR_POSITIONS[id];
    if (!position) return;
    const out = panner(e, position, 2);
    out.connect(e.master);
    const at = e.ctx.currentTime + 0.01;

    if (open) burst(e, out, at, 0.03, 0.5, filter(e, 'bandpass', 3200, 3));
    const swing = open ? 0.6 : 0.4;
    const sweep = filter(e, 'bandpass', 900, 1.5);
    sweep.frequency.setValueAtTime(900, at);
    sweep.frequency.exponentialRampToValueAtTime(320, at + swing);
    const src = new AudioBufferSourceNode(e.ctx, { buffer: e.noise.pink });
    const env = amp(e, 0);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.4, at + swing * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, at + swing);
    src.connect(sweep).connect(env).connect(out);
    src.start(at, Math.random() * 4, swing + 0.05);

    if (!open) {
        const shut = at + 0.42;
        thump(e, out, shut, 95, 42, 0.2, 0.25);
        burst(e, out, shut, 0.15, 0.3, filter(e, 'lowpass', 350));
        burst(e, out, shut + 0.02, 0.03, 0.25, filter(e, 'bandpass', 3000, 3));
    }
}
