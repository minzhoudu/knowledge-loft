import { PIXELS } from './cabinet';

/**
 * PUNCTURE RUN, the game in the lobby's arcade cabinet.
 *
 * You drive up an endless road with three spare-tyre lives. Nails and
 * potholes cost a tyre, so does running into slower traffic; cones only
 * knock your speed down. Spare tyres on the road give one back. The road
 * gets faster the longer you last. (A nod to the tyre-shop app in the notes.)
 *
 * Plain TypeScript, no React or three.js: the cabinet calls update() and
 * draw() every frame and copies the canvas onto the screen's texture. The
 * game draws at the cabinet's real resolution, 240×320 pixels, with
 * rectangles and text only, so it looks the part on a picture tube.
 *
 * Between games it plays itself (attract mode, like real cabinets did to
 * pull in players): a simple autopilot steers for whichever lane is clear
 * the furthest ahead.
 */

export type Phase = 'attract' | 'countdown' | 'playing' | 'over';
export type Sound = 'count' | 'go' | 'pickup' | 'puncture' | 'crash' | 'bump' | 'over';

type Kind = 'nails' | 'pothole' | 'cone' | 'car' | 'tyre';
type Thing = {
    kind: Kind;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Cars drive too: they come toward you at this fraction of the road's speed. */
    pace: number;
    hit: boolean;
    color: string;
    /** A knocked-over cone tumbles off sideways. */
    vx: number;
    spin: number;
};
type Popup = { text: string; x: number; y: number; t: number; color: string };

const W = PIXELS.width;
const H = PIXELS.height;
const ROAD = { x0: 42, x1: 198 };
const LANES = 3;
const LANE_W = (ROAD.x1 - ROAD.x0) / LANES;
const laneX = (i: number) => ROAD.x0 + LANE_W * (i + 0.5);
/** The player's car: its centre line on screen, and size. */
const CAR = { y: 268, w: 16, h: 28 };

const START_SPEED = 150; // pixels per second
const MAX_SPEED = 380;
const ACCEL = 5; // speed gained per second of driving
const STEER = 190; // sideways pixels per second at full lock
const LIVES = 3;
const BEST_KEY = 'puncture-run-best';

const SIZE: Record<Kind, [number, number]> = {
    nails: [24, 10],
    pothole: [28, 16],
    cone: [12, 14],
    car: [16, 28],
    tyre: [16, 16],
};
const TRAFFIC = ['#5aa7d6', '#9bd36a', '#d65a7f', '#e8e2d4', '#b08be0'];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export class Game {
    phase: Phase = 'attract';
    /** Seconds in the current phase. */
    t = 0;
    best = 0;
    newBest = false;

    private speed = START_SPEED;
    private distance = 0;
    private bonus = 0;
    private tyres = LIVES;
    private driven = 0; // seconds since the green light
    private carX = laneX(1);
    private carVX = 0;
    private invulnerable = 0;
    private shake = 0;
    private things: Thing[] = [];
    private popups: Popup[] = [];
    private nextRow = 0;
    private scroll = 0;
    /** The autopilot's chosen lane, and when it next looks again. */
    private aiLane = 1;
    private aiThink = 0;
    /** The last steering input, for the joystick on the control panel. */
    steer = 0;

    constructor(private onSound: (sound: Sound) => void) {
        try {
            this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
        } catch {
            // storage blocked (private window): the best score just isn't remembered
        }
        this.resetRun();
    }

    get score() {
        return Math.floor(this.distance / 8) + this.bonus;
    }

    /** The start button: begin a game, or another one after game over. */
    press() {
        if (this.phase === 'attract' || (this.phase === 'over' && this.t > 1)) {
            this.resetRun();
            this.speed = 0;
            this.setPhase('countdown');
        }
    }

    /** The player walked away: back to the demo. */
    abandon() {
        if (this.phase === 'attract') return;
        this.resetRun();
        this.setPhase('attract');
    }

    /**
     * Advance the game. `steer` is -1 (left) to 1 (right); in attract mode
     * the autopilot ignores it and steers by itself.
     */
    update(dt: number, steer: number) {
        dt = Math.min(dt, 0.05); // a stalled frame (tab switch) mustn't teleport anything
        this.t += dt;
        const demo = this.phase === 'attract';

        if (this.phase === 'countdown') {
            // Three beeps a second apart, then a higher one: go.
            const before = Math.floor(this.t - dt);
            const now = Math.floor(this.t);
            if (now !== before && now < 3) this.onSound('count');
            if (this.t >= 3) {
                this.onSound('go');
                this.speed = START_SPEED;
                this.setPhase('playing');
            }
        }
        if (this.phase === 'over') {
            if (this.t > 10) this.abandon(); // nobody pressed start: back to the demo
            this.speed = Math.max(0, this.speed - 400 * dt);
        }

        const driving = this.phase === 'playing' || demo;
        if (driving) {
            this.driven += dt;
            this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt);
        }

        // Steering: ease the sideways speed toward the input, so the car has a little weight.
        const input = demo ? this.autopilot(dt) : driving ? steer : 0;
        this.steer = input;
        this.carVX += (input * STEER - this.carVX) * Math.min(1, dt * 10);
        this.carX = clamp(this.carX + this.carVX * dt, ROAD.x0 + 10, ROAD.x1 - 10);

        // The world moves down the screen; the car stays put.
        const step = this.speed * dt;
        this.distance += driving ? step : 0;
        this.scroll += step;
        if (driving && this.distance >= this.nextRow) this.spawnRow();

        for (const th of this.things) {
            th.y += step * (1 - th.pace);
            if (th.hit && th.kind === 'cone') {
                th.x += th.vx * dt;
                th.y -= 60 * dt;
                th.spin += dt * 12;
            }
        }
        this.things = this.things.filter((th) => th.y < H + 40 && th.x > -20 && th.x < W + 20);

        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.shake = Math.max(0, this.shake - dt);
        for (const p of this.popups) p.t += dt;
        this.popups = this.popups.filter((p) => p.t < 1);

        if (driving) this.collide(demo);
    }

    private setPhase(phase: Phase) {
        this.phase = phase;
        this.t = 0;
    }

    private resetRun() {
        this.speed = START_SPEED;
        this.distance = 0;
        this.bonus = 0;
        this.tyres = LIVES;
        this.driven = 0;
        this.carX = laneX(1);
        this.carVX = 0;
        this.invulnerable = 0;
        this.things = [];
        this.popups = [];
        this.nextRow = 120;
        this.newBest = false;
    }

    /** A row of trouble across the road, always with at least one way through. */
    private spawnRow() {
        // Rows come closer together as the game goes on (and faster, on top).
        const gap = Math.max(70, 170 - this.driven * 1.6);
        this.nextRow = this.distance + gap * (0.8 + Math.random() * 0.4);

        // A lane is taken if a slow car is still near the top in it.
        const taken = new Set<number>();
        for (const th of this.things) {
            if (th.kind === 'car' && th.y < 110) taken.add(this.laneOf(th.x));
        }
        const free = [0, 1, 2].filter((i) => !taken.has(i));
        const count = this.driven > 12 && Math.random() < 0.45 ? 2 : 1;
        const blocked: number[] = [];
        while (blocked.length < count && free.length > 1) {
            blocked.push(...free.splice(Math.floor(Math.random() * free.length), 1));
        }
        for (const lane of blocked) {
            const r = Math.random();
            const kind: Kind =
                r < 0.34 ? 'nails' : r < 0.58 ? 'pothole' : r < 0.78 ? 'cone' : 'car';
            this.add(kind, lane);
        }
        const chance = this.tyres < LIVES ? 0.16 : 0.08;
        if (free.length && Math.random() < chance) this.add('tyre', pick(free));
    }

    private add(kind: Kind, lane: number) {
        const [w, h] = SIZE[kind];
        this.things.push({
            kind,
            x: laneX(lane) + (Math.random() - 0.5) * (kind === 'car' ? 6 : 18),
            y: -30,
            w,
            h,
            pace: kind === 'car' ? 0.45 : 0,
            hit: false,
            color: kind === 'car' ? pick(TRAFFIC) : '',
            vx: 0,
            spin: 0,
        });
    }

    private laneOf(x: number) {
        return clamp(Math.floor((x - ROAD.x0) / LANE_W), 0, LANES - 1);
    }

    private collide(demo: boolean) {
        const cx0 = this.carX - CAR.w / 2 + 2;
        const cx1 = this.carX + CAR.w / 2 - 2;
        const cy0 = CAR.y - CAR.h / 2 + 2;
        const cy1 = CAR.y + CAR.h / 2 - 2;
        const sound = (s: Sound) => !demo && this.onSound(s);

        for (const th of this.things) {
            if (th.hit) continue;
            const overlap =
                th.x + th.w / 2 > cx0 &&
                th.x - th.w / 2 < cx1 &&
                th.y + th.h / 2 > cy0 &&
                th.y - th.h / 2 < cy1;
            if (!overlap) continue;

            if (th.kind === 'tyre') {
                th.hit = true;
                if (this.tyres < LIVES) {
                    this.tyres++;
                    this.popup('+1 TYRE', '#7fd18b');
                } else {
                    this.bonus += 100;
                    this.popup('+100', '#ffd75e');
                }
                sound('pickup');
                continue;
            }
            if (th.kind === 'cone') {
                // Cones don't puncture anything; they just cost you speed.
                th.hit = true;
                th.vx = (th.x < this.carX ? -1 : 1) * 120;
                this.speed *= 0.7;
                this.shake = 0.15;
                sound('bump');
                continue;
            }
            if (this.invulnerable > 0) continue;

            th.hit = th.kind !== 'pothole'; // a pothole stays where it is
            this.tyres--;
            this.invulnerable = 1.6;
            this.shake = th.kind === 'car' ? 0.45 : 0.3;
            this.speed *= th.kind === 'car' ? 0.55 : 0.8;
            this.popup(th.kind === 'car' ? 'CRASH!' : 'PUNCTURE!', '#ff6b5e');
            sound(th.kind === 'car' ? 'crash' : 'puncture');

            if (this.tyres <= 0) {
                if (demo) {
                    this.resetRun(); // the demo just starts over
                    return;
                }
                if (this.score > this.best) {
                    this.best = this.score;
                    this.newBest = true;
                    try {
                        localStorage.setItem(BEST_KEY, String(this.best));
                    } catch {
                        // not remembered; fine
                    }
                }
                this.onSound('over');
                this.setPhase('over');
                return;
            }
        }
    }

    private popup(text: string, color: string) {
        this.popups.push({ text, x: this.carX, y: CAR.y - 26, t: 0, color });
    }

    /**
     * The demo driver: every quarter second, look up the road and pick the
     * lane that stays clear the furthest (spare tyres count as a plus).
     * Stick with the current lane unless another is clearly better, so it
     * doesn't dither. It reacts late on purpose, so it crashes now and then.
     */
    private autopilot(dt: number) {
        this.aiThink -= dt;
        if (this.aiThink <= 0) {
            this.aiThink = 0.25;
            const clearance = [0, 1, 2].map((lane) => {
                let clear = 220;
                for (const th of this.things) {
                    if (th.hit || Math.abs(th.x - laneX(lane)) > LANE_W * 0.6) continue;
                    const ahead = CAR.y - th.y;
                    if (ahead < -10 || ahead > 220) continue;
                    if (th.kind === 'tyre') clear += 40;
                    else clear = Math.min(clear, ahead);
                }
                return clear;
            });
            const bestLane = clearance.indexOf(Math.max(...clearance));
            if (clearance[bestLane] > clearance[this.aiLane] + 30) this.aiLane = bestLane;
        }
        return clamp((laneX(this.aiLane) - this.carX) / 14, -1, 1);
    }

    // ---- Drawing ----------------------------------------------------------

    /**
     * Draw a frame. `prompt` is the blinking line in attract mode and after
     * game over ("PRESS ENTER", "TAP START", or a hint to walk up).
     */
    draw(g: CanvasRenderingContext2D, font: string, prompt: string) {
        g.save();
        if (this.shake > 0) {
            const s = this.shake * 10;
            g.translate(
                Math.round((Math.random() - 0.5) * s),
                Math.round((Math.random() - 0.5) * s),
            );
        }
        this.drawRoad(g);
        for (const th of this.things) this.drawThing(g, th);
        const blink = this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 0;
        if (!blink && this.phase !== 'over') drawCar(g, this.carX, CAR.y, '#f08c2e', this.carVX);
        if (this.phase === 'over') this.drawWreck(g);
        g.restore();

        for (const p of this.popups) {
            g.globalAlpha = 1 - p.t;
            text(g, font, p.text, p.x, p.y - p.t * 24, 11, p.color);
        }
        g.globalAlpha = 1;

        this.drawHud(g, font);
        const flash = Math.floor(this.t * 2.5) % 2 === 0;
        if (this.phase === 'attract') this.drawTitle(g, font, prompt, flash);
        if (this.phase === 'countdown') {
            const n = 3 - Math.floor(this.t);
            text(g, font, String(n), W / 2, H / 2 - 10, 54, '#ffd75e');
        }
        if (this.phase === 'playing' && this.t < 0.8) {
            text(g, font, 'GO!', W / 2, H / 2 - 10, 46, '#7fd18b');
        }
        if (this.phase === 'over') this.drawOver(g, font, prompt, flash);
    }

    private drawRoad(g: CanvasRenderingContext2D) {
        // Verges: dark scrubland with bushes going by.
        g.fillStyle = '#1b2a20';
        g.fillRect(0, 0, W, H);
        for (let k = 0; k < 14; k++) {
            const y = ((k * 61 + this.scroll * 0.98) % (H + 40)) - 20;
            const left = 6 + ((k * 23) % 22);
            const right = ROAD.x1 + 10 + ((k * 31) % 20);
            g.fillStyle = k % 3 ? '#2c4a2f' : '#3b5f36';
            g.fillRect(left, y, 12, 9);
            g.fillRect(left + 3, y - 4, 7, 4);
            g.fillStyle = k % 2 ? '#2c4a2f' : '#3b5f36';
            g.fillRect(right, y + 30, 11, 8);
            g.fillRect(right + 2, y + 26, 7, 4);
        }

        g.fillStyle = '#2a2c31';
        g.fillRect(ROAD.x0, 0, ROAD.x1 - ROAD.x0, H);

        // Kerbs: red and white blocks, scrolling with the road.
        const block = 16;
        const off = this.scroll % (block * 2);
        for (let y = -block * 2 + off; y < H; y += block) {
            const red = Math.round((y - off) / block) % 2 === 0;
            g.fillStyle = red ? '#c8463c' : '#e8e2d4';
            g.fillRect(ROAD.x0 - 6, y, 6, block);
            g.fillRect(ROAD.x1, y, 6, block);
        }

        // Lane dashes.
        g.fillStyle = '#d9d4c7';
        const dash = 36;
        const doff = this.scroll % dash;
        for (let lane = 1; lane < LANES; lane++) {
            const x = Math.round(ROAD.x0 + lane * LANE_W) - 1;
            for (let y = -dash + doff; y < H; y += dash) g.fillRect(x, y, 3, 16);
        }
    }

    private drawThing(g: CanvasRenderingContext2D, th: Thing) {
        const x = Math.round(th.x);
        const y = Math.round(th.y);
        switch (th.kind) {
            case 'nails': {
                // A scatter of nails: grey shanks with bright heads.
                const pins = [
                    [-10, -2, 1],
                    [-5, 2, 0],
                    [-1, -3, 1],
                    [3, 1, 0],
                    [8, -2, 1],
                    [10, 3, 0],
                ];
                for (const [dx, dy, flip] of pins) {
                    g.fillStyle = '#8d9096';
                    if (flip) g.fillRect(x + dx - 3, y + dy, 7, 2);
                    else g.fillRect(x + dx, y + dy - 3, 2, 7);
                    g.fillStyle = '#e6e8ec';
                    g.fillRect(x + dx, y + dy, 2, 2);
                }
                break;
            }
            case 'pothole':
                g.fillStyle = '#45474d';
                ellipse(g, x, y, 15, 9);
                g.fillStyle = '#121316';
                ellipse(g, x, y + 1, 12, 6);
                break;
            case 'cone':
                g.save();
                g.translate(x, y);
                g.rotate(th.spin);
                g.fillStyle = '#f2792b';
                g.beginPath();
                g.moveTo(0, -7);
                g.lineTo(6, 6);
                g.lineTo(-6, 6);
                g.closePath();
                g.fill();
                g.fillStyle = '#f4efe4';
                g.fillRect(-3, -1, 6, 3);
                g.fillStyle = '#d4601c';
                g.fillRect(-7, 6, 14, 2);
                g.restore();
                break;
            case 'car':
                drawCar(g, x, y, th.color, 0);
                break;
            case 'tyre': {
                if (th.hit) break;
                const bob = Math.round(Math.sin(this.scroll * 0.05) * 1.5);
                drawTyre(g, x, y + bob, 8);
                break;
            }
        }
    }

    private drawWreck(g: CanvasRenderingContext2D) {
        drawCar(g, this.carX, CAR.y, '#a35a22', 0);
        // A wisp of smoke.
        for (let i = 0; i < 4; i++) {
            const age = (this.t * 1.5 + i / 4) % 1;
            g.globalAlpha = 0.5 * (1 - age);
            g.fillStyle = '#9a9a9a';
            const r = 3 + age * 8;
            g.fillRect(this.carX - r / 2 + Math.sin(i + this.t) * 4, CAR.y - 14 - age * 40, r, r);
        }
        g.globalAlpha = 1;
    }

    private drawHud(g: CanvasRenderingContext2D, font: string) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(0, 0, W, 20);
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = `700 11px ${font}`;
        g.fillStyle = '#ffd75e';
        g.fillText(`SCORE ${String(this.score).padStart(6, '0')}`, 6, 11);
        for (let i = 0; i < LIVES; i++) {
            const x = W - 14 - i * 18;
            if (i < this.tyres) drawTyre(g, x, 10, 6);
            else {
                g.strokeStyle = '#555';
                g.lineWidth = 1;
                g.strokeRect(x - 5.5, 4.5, 11, 11);
            }
        }
    }

    private drawTitle(g: CanvasRenderingContext2D, font: string, prompt: string, flash: boolean) {
        g.fillStyle = 'rgba(8,8,14,0.72)';
        g.fillRect(16, 70, W - 32, 150);
        g.strokeStyle = '#f08c2e';
        g.lineWidth = 2;
        g.strokeRect(17, 71, W - 34, 148);
        text(g, font, 'PUNCTURE', W / 2, 98, 30, '#f08c2e');
        text(g, font, 'RUN', W / 2, 128, 30, '#ffd75e');
        text(g, font, 'DODGE NAILS  GRAB SPARES', W / 2, 158, 9, '#d9d4c7');
        text(g, font, `HI ${String(this.best).padStart(6, '0')}`, W / 2, 178, 11, '#7fd18b');
        if (flash) text(g, font, prompt, W / 2, 202, 12, '#ffffff');
    }

    private drawOver(g: CanvasRenderingContext2D, font: string, prompt: string, flash: boolean) {
        g.fillStyle = 'rgba(8,8,14,0.75)';
        g.fillRect(16, 80, W - 32, 140);
        text(g, font, 'GAME OVER', W / 2, 108, 26, '#ff6b5e');
        text(g, font, `SCORE ${this.score}`, W / 2, 140, 13, '#ffd75e');
        text(g, font, `BEST  ${this.best}`, W / 2, 160, 13, '#7fd18b');
        if (this.newBest && flash) text(g, font, 'NEW BEST!', W / 2, 182, 12, '#ffffff');
        if (this.t > 1 && (!this.newBest || !flash))
            text(g, font, prompt, W / 2, 202, 11, '#d9d4c7');
    }
}

function text(
    g: CanvasRenderingContext2D,
    font: string,
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
) {
    g.font = `700 ${size}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // A hard drop shadow, one pixel down and right: the classic arcade lettering.
    g.fillStyle = '#000';
    g.fillText(s, x + 1, y + 1);
    g.fillStyle = color;
    g.fillText(s, x, y);
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
}

function drawTyre(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    g.fillStyle = '#16171a';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#4a4c52';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#c9ccd2';
    g.beginPath();
    g.arc(x, y, r * 0.38, 0, Math.PI * 2);
    g.fill();
}

/** A car seen from above, driving up the screen. */
function drawCar(g: CanvasRenderingContext2D, cx: number, cy: number, color: string, lean: number) {
    const x = Math.round(cx - CAR.w / 2);
    const y = Math.round(cy - CAR.h / 2);
    // Wheels peek out at the sides; they shift a pixel as the car steers.
    const turn = Math.round(clamp(lean / STEER, -1, 1));
    g.fillStyle = '#0d0d10';
    g.fillRect(x - 2 + turn, y + 4, 3, 7);
    g.fillRect(x + CAR.w - 1 + turn, y + 4, 3, 7);
    g.fillRect(x - 2, y + CAR.h - 10, 3, 7);
    g.fillRect(x + CAR.w - 1, y + CAR.h - 10, 3, 7);
    // Body, roof and glass.
    g.fillStyle = color;
    g.fillRect(x, y, CAR.w, CAR.h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y + 9, CAR.w - 6, 11);
    g.fillStyle = '#1e2a3a';
    g.fillRect(x + 2, y + 5, CAR.w - 4, 4); // windscreen
    g.fillRect(x + 3, y + CAR.h - 7, CAR.w - 6, 3); // rear window
    // Lights: headlights at the front, red at the back.
    g.fillStyle = '#fff3c4';
    g.fillRect(x + 1, y, 3, 2);
    g.fillRect(x + CAR.w - 4, y, 3, 2);
    g.fillStyle = '#e0302a';
    g.fillRect(x + 1, y + CAR.h - 2, 3, 2);
    g.fillRect(x + CAR.w - 4, y + CAR.h - 2, 3, 2);
}
