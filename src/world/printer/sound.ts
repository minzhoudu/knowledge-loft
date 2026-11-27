import { at } from '@/world/switches/sound';

type Vec3 = [number, number, number];

/**
 * A laser printer printing one page, synthesised and heard from where it
 * stands (see audio/engine.ts): a two-note wake-up chime, the fuser motor
 * humming, the rollers ticking as the paper feeds through, and a soft
 * thump as the sheet drops into the tray. Timed to match Printer.tsx:
 * feed from `feed[0]` to `feed[1]` seconds, done at `end`.
 */
export function playPrint(position: Vec3, feed: [number, number], end: number) {
    const a = at(position);
    if (!a) return;
    const { e, out, t } = a;

    // wake-up chime
    for (const [delay, f] of [
        [0, 1320],
        [0.13, 1760],
    ]) {
        const osc = new OscillatorNode(e.ctx, { frequency: f, type: 'sine' });
        const env = new GainNode(e.ctx, { gain: 0 });
        env.gain.setValueAtTime(0.05, t + delay);
        env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.09);
        osc.connect(env).connect(out);
        osc.start(t + delay);
        osc.stop(t + delay + 0.1);
    }

    // the motor: a low buzz and a faint whine, rising in and out
    const hum = new GainNode(e.ctx, { gain: 0 });
    hum.connect(out);
    const on = t + 0.3;
    const off = t + end - 0.15;
    hum.gain.setValueAtTime(0, on);
    hum.gain.linearRampToValueAtTime(0.05, on + 0.2);
    hum.gain.setValueAtTime(0.05, off - 0.25);
    hum.gain.linearRampToValueAtTime(0, off);
    for (const [f, type, g] of [
        [74, 'sawtooth', 0.6],
        [930, 'sine', 0.05],
    ] as const) {
        const osc = new OscillatorNode(e.ctx, { frequency: f, type });
        osc.connect(new BiquadFilterNode(e.ctx, { type: 'lowpass', frequency: 700 }))
            .connect(new GainNode(e.ctx, { gain: g }))
            .connect(hum);
        osc.start(on);
        osc.stop(off + 0.05);
    }

    // the rollers: short ticks of filtered noise while the paper moves
    for (let s = feed[0]; s < feed[1]; s += 0.075) {
        const src = new AudioBufferSourceNode(e.ctx, { buffer: e.noise.white });
        const band = new BiquadFilterNode(e.ctx, { type: 'bandpass', frequency: 2100, Q: 3 });
        const env = new GainNode(e.ctx, { gain: 0 });
        env.gain.setValueAtTime(0.07, t + s);
        env.gain.exponentialRampToValueAtTime(0.0001, t + s + 0.03);
        src.connect(band).connect(env).connect(out);
        src.start(t + s, Math.random() * 3, 0.04);
    }

    // the sheet settling into the tray
    const thump = new OscillatorNode(e.ctx, { frequency: 140, type: 'sine' });
    const env = new GainNode(e.ctx, { gain: 0 });
    env.gain.setValueAtTime(0.12, t + feed[1] + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + feed[1] + 0.2);
    thump.connect(env).connect(out);
    thump.start(t + feed[1] + 0.05);
    thump.stop(t + feed[1] + 0.25);
}
