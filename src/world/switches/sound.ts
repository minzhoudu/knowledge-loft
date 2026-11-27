import { getAudio } from '@/world/audio/engine';

/**
 * A switch's click and a blind's motor, synthesised like the rest of the
 * loft's sound (see audio/engine.ts), and heard from where they are.
 */

type Vec3 = [number, number, number];

/** A sound source at a point in the loft (the printer uses it too). */
export function at(position: Vec3) {
    const e = getAudio();
    if (!e) return null;
    const [x, y, z] = position;
    const out = new PannerNode(e.ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 1,
        positionX: x,
        positionY: y,
        positionZ: z,
    });
    out.connect(e.master);
    return { e, out, t: e.ctx.currentTime + 0.01 };
}

/** A light switch: two tiny clicks a few milliseconds apart (the lever, then the contact). */
export function playClick(position: Vec3) {
    const a = at(position);
    if (!a) return;
    const { e, out, t } = a;
    for (const [delay, gain, f] of [
        [0, 0.5, 3800],
        [0.012, 0.3, 2600],
    ]) {
        const src = new AudioBufferSourceNode(e.ctx, { buffer: e.noise.white });
        const band = new BiquadFilterNode(e.ctx, { type: 'bandpass', frequency: f, Q: 4 });
        const env = new GainNode(e.ctx, { gain: 0 });
        env.gain.setValueAtTime(gain, t + delay);
        env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.025);
        src.connect(band).connect(env).connect(out);
        src.start(t + delay, Math.random() * 3, 0.05);
    }
}

/**
 * A roller blind's motor: a low hum with a faint whine, for as long as the
 * blind takes to travel.
 */
export function playMotor(position: Vec3, seconds: number) {
    if (seconds < 0.3) return; // already (almost) there: nothing to hear
    const a = at(position);
    if (!a) return;
    const { e, out, t } = a;
    const env = new GainNode(e.ctx, { gain: 0 });
    env.connect(out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.05, t + 0.15);
    env.gain.setValueAtTime(0.05, t + seconds - 0.2);
    env.gain.linearRampToValueAtTime(0, t + seconds);
    for (const [f, type, g] of [
        [92, 'sawtooth', 0.5],
        [640, 'sine', 0.08],
    ] as const) {
        const osc = new OscillatorNode(e.ctx, { frequency: f, type });
        const low = new BiquadFilterNode(e.ctx, { type: 'lowpass', frequency: 900 });
        osc.connect(low)
            .connect(new GainNode(e.ctx, { gain: g }))
            .connect(env);
        osc.start(t);
        osc.stop(t + seconds + 0.05);
    }
}
