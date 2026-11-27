import { getAudio } from '@/world/audio/engine';
import { ARCADE_SCREEN } from './cabinet';
import type { Sound } from './game';

/**
 * The cabinet's sound effects, synthesised on the spot like everything else
 * in the loft's audio (see audio/engine.ts). Old arcade sound chips had a
 * few square-wave channels plus a noise channel; that's all these use:
 *
 * - beeps: a square wave with a fast decay;
 * - blips going up (a pickup) or down (game over): the same, note after note;
 * - punctures and crashes: a burst of noise, filtered, over a falling tone.
 *
 * They come from the cabinet's speaker: a panner at the screen, so you hear
 * where the machine is when someone (you) is playing it.
 */

let speaker: PannerNode | null = null;

function out() {
    const e = getAudio();
    if (!e) return null; // audio starts with the Enter button; until then, silence
    if (!speaker) {
        const [x, y, z] = ARCADE_SCREEN.center;
        speaker = new PannerNode(e.ctx, {
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            refDistance: 1.5,
            positionX: x,
            positionY: y - 0.3,
            positionZ: z,
        });
        speaker.connect(e.master);
    }
    return { ctx: e.ctx, noise: e.noise.white, speaker };
}

type Out = NonNullable<ReturnType<typeof out>>;

function beep(o: Out, at: number, frequency: number, length: number, gain = 0.07) {
    const osc = new OscillatorNode(o.ctx, { type: 'square', frequency });
    const env = new GainNode(o.ctx, { gain: 0 });
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(o.speaker);
    osc.start(at);
    osc.stop(at + length + 0.02);
}

function hiss(o: Out, at: number, length: number, from: number, to: number, gain: number) {
    const src = new AudioBufferSourceNode(o.ctx, { buffer: o.noise });
    const band = new BiquadFilterNode(o.ctx, { type: 'bandpass', frequency: from, Q: 1.2 });
    band.frequency.setValueAtTime(from, at);
    band.frequency.exponentialRampToValueAtTime(to, at + length);
    const env = new GainNode(o.ctx, { gain: 0 });
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(band).connect(env).connect(o.speaker);
    src.start(at, Math.random() * 3, length + 0.05);
}

function drop(o: Out, at: number, from: number, to: number, length: number, gain: number) {
    const osc = new OscillatorNode(o.ctx, { type: 'square', frequency: from });
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    const env = new GainNode(o.ctx, { gain: 0 });
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(env).connect(o.speaker);
    osc.start(at);
    osc.stop(at + length + 0.02);
}

export function playArcade(sound: Sound) {
    const o = out();
    if (!o) return;
    const at = o.ctx.currentTime + 0.01;
    switch (sound) {
        case 'count':
            beep(o, at, 440, 0.18);
            break;
        case 'go':
            beep(o, at, 880, 0.4);
            break;
        case 'pickup':
            // An arpeggio up a major chord: C, E, G, C.
            [523, 659, 784, 1047].forEach((f, i) => beep(o, at + i * 0.055, f, 0.09, 0.05));
            break;
        case 'puncture':
            // Air rushing out of a tyre: hiss sweeping down, with a pop at the start.
            beep(o, at, 220, 0.05, 0.08);
            hiss(o, at, 0.7, 6000, 900, 0.22);
            break;
        case 'crash':
            hiss(o, at, 0.45, 1800, 200, 0.35);
            drop(o, at, 180, 40, 0.4, 0.12);
            break;
        case 'bump':
            drop(o, at, 300, 120, 0.12, 0.06);
            break;
        case 'over':
            // Down a minor scale, slowing: the sad trombone of 8-bit games.
            [392, 349, 311, 262].forEach((f, i) => beep(o, at + i * 0.22, f, 0.25, 0.06));
            break;
    }
}
