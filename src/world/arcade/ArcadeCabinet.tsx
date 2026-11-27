'use client';

import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import {
    CanvasTexture,
    ExtrudeGeometry,
    LinearMipmapLinearFilter,
    NearestFilter,
    ShaderMaterial,
    Shape,
    SRGBColorSpace,
    Vector2,
    Vector3,
    type Group,
    type Mesh,
} from 'three';
import { useWorld } from '@/store/world';
import { useIsFocused } from '@/world/interaction/Interactable';
import { held } from '@/world/player/controls';
import { MARKERS } from '@/world/rooms/lobby/layout';
import {
    ARCADE_SCREEN,
    face,
    GLASS,
    GLASS_AT,
    KICK_FACE,
    MARQUEE_FACE,
    PANEL_FACE,
    PIXELS,
    POINT,
    PROFILE,
    SCREEN_FACE,
    SIDE,
    WIDTH,
} from './cabinet';
import { machine, pad } from './machine';

/**
 * The lobby's arcade cabinet, built in code rather than modelled: its body
 * is one side profile (cabinet.ts) extruded to width, so every panel on the
 * front lands exactly on the outline. See ArcadeScreen for the game.
 */

const BODY = '#17181c';
const TRIM = '#f08c2e';

const { position, rotationY } = MARKERS.centrepiece;

export function ArcadeCabinet() {
    const focused = useIsFocused();
    // While you aim at it, the orange trim lights up along every edge (the
    // artwork stays as it is: any glow over its dark paint washes it out).
    const glow = focused ? 0.6 : 0;
    const { body, side, art } = useMemo(() => {
        const shape = new Shape(PROFILE.map(([z, y]) => new Vector2(z, y)));
        // ExtrudeGeometry pushes a 2D shape out along +z. Turning it a quarter
        // round y maps the shape's x (our profile's z) onto z, and the
        // extrusion onto -x: the profile now stands upright, sideways on.
        const body = new ExtrudeGeometry(shape, { depth: WIDTH, bevelEnabled: false });
        body.rotateY(-Math.PI / 2);
        body.translate(WIDTH / 2, 0, 0);
        const side = new ExtrudeGeometry(shape, { depth: SIDE, bevelEnabled: false });
        side.rotateY(-Math.PI / 2);
        return { body, side, art: drawSideArt() };
    }, []);
    useEffect(
        () => () => {
            body.dispose();
            side.dispose();
            art.dispose();
        },
        [body, side, art],
    );

    // An extruded shape has two material groups: 0 for the flat caps (the
    // outline itself), 1 for the walls around its edge. On a side panel the
    // caps get the artwork and the edge becomes the coloured trim.
    const sideMaterials = (
        <>
            <meshStandardMaterial attach="material-0" map={art} roughness={0.45} />
            <meshStandardMaterial
                attach="material-1"
                color={TRIM}
                roughness={0.35}
                metalness={0.1}
                emissive={TRIM}
                emissiveIntensity={glow}
            />
        </>
    );

    return (
        <group position={position} rotation-y={rotationY}>
            {/* A box collider around it all, like the furniture (see Model). */}
            <RigidBody type="fixed" colliders={false}>
                <CuboidCollider
                    args={[WIDTH / 2 + SIDE, POINT.marqueeTop[1] / 2, 0.445]}
                    position={[0, POINT.marqueeTop[1] / 2, 0.025]}
                />
            </RigidBody>

            <mesh geometry={body} castShadow receiveShadow>
                <meshStandardMaterial
                    color={BODY}
                    roughness={0.6}
                    emissive="#3a3d46"
                    emissiveIntensity={glow}
                />
            </mesh>
            <mesh geometry={side} position-x={-WIDTH / 2} castShadow receiveShadow>
                {sideMaterials}
            </mesh>
            <mesh geometry={side} position-x={WIDTH / 2 + SIDE} castShadow receiveShadow>
                {sideMaterials}
            </mesh>

            <Marquee />
            <Bezel />
            <ArcadeScreen />
            <ControlPanel />
            <CoinDoor />
        </group>
    );
}

/** A flat panel lying on one face of the profile (see `face` in cabinet.ts). */
function OnFace({ at, children }: { at: ReturnType<typeof face>; children: React.ReactNode }) {
    return (
        <group position={[0, at.y, at.z]} rotation-x={at.tilt}>
            {children}
        </group>
    );
}

function Marquee() {
    const texture = useMemo(() => drawMarquee(), []);
    useEffect(() => () => texture.dispose(), [texture]);
    return (
        <OnFace at={face(POINT.marqueeBottom, POINT.marqueeTop, 0.003)}>
            <mesh>
                <planeGeometry args={[WIDTH, MARQUEE_FACE.length]} />
                {/* A backlit sign: all its light is its own, bright enough to bloom. */}
                <meshStandardMaterial
                    color="#000"
                    emissive="#fff"
                    emissiveMap={texture}
                    emissiveIntensity={1.5}
                    roughness={0.3}
                />
            </mesh>
        </OnFace>
    );
}

function Bezel() {
    return (
        <OnFace at={face(POINT.screenBottom, POINT.screenTop, 0.003)}>
            <mesh receiveShadow>
                <planeGeometry args={[WIDTH - 0.03, SCREEN_FACE.length - 0.012]} />
                <meshStandardMaterial color="#060607" roughness={0.25} />
            </mesh>
        </OnFace>
    );
}

/**
 * The picture tube. The game (game.ts) draws into a small canvas at the
 * machine's real resolution, and the canvas becomes this screen's texture,
 * re-uploaded to the GPU after every frame it draws.
 *
 * The screen's material is a small custom shader rather than a standard
 * material, because a CRT's look is all in how it shows its pixels:
 * - Barrel distortion: the glass bulges, so the picture curves at the edges
 *   and the corners round off.
 * - Scanlines: the electron beam draws each row of pixels as a bright line
 *   with a dark gap below it.
 * - Vignette: the picture is dimmer toward the edges.
 * - Brightness above 1: it's a light source, so the brightest pixels bloom.
 */
const VERTEX = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAGMENT = /* glsl */ `
    uniform sampler2D map;
    uniform float rows;
    uniform float brightness;
    varying vec2 vUv;

    void main() {
        // Barrel distortion: sample further out the further from the centre,
        // which squeezes the picture toward the middle like a bulging tube.
        vec2 c = vUv * 2.0 - 1.0;
        vec2 uv = c * (1.0 + 0.055 * dot(c, c)) * 0.5 + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }
        vec3 color = texture2D(map, uv).rgb;

        // Scanlines: sin() is 0 on the boundary between two pixel rows and
        // peaks mid-row. Seen from across the room, a screen pixel covers many
        // rows and the lines would shimmer (moiré), so they fade out: fwidth
        // says how many rows this one screen pixel spans.
        float row = uv.y * rows;
        float line = sin(row * 3.14159265);
        float fade = smoothstep(1.2, 0.5, fwidth(row));
        color *= 1.0 - 0.45 * fade * (1.0 - line * line);

        // Dimmer toward the edges and corners.
        color *= 1.0 - 0.3 * dot(c, c) * 0.5;

        gl_FragColor = vec4(color * brightness, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const screenAt = new Vector3(...ARCADE_SCREEN.center);
/** Beyond this, nobody can see the screen well enough to need it running. */
const AWAKE_DISTANCE = 16;

function ArcadeScreen() {
    const { g, texture, material } = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = PIXELS.width;
        canvas.height = PIXELS.height;
        const g = canvas.getContext('2d')!;
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        // Up close, keep the pixels square and crisp (nearest); from afar,
        // average them through mipmaps so the picture doesn't sparkle.
        texture.magFilter = NearestFilter;
        texture.minFilter = LinearMipmapLinearFilter;
        const material = new ShaderMaterial({
            uniforms: {
                map: { value: texture },
                rows: { value: PIXELS.height },
                brightness: { value: 1.35 },
            },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
        });
        return { g, texture, material };
    }, []);
    useEffect(
        () => () => {
            texture.dispose();
            material.dispose();
        },
        [texture, material],
    );

    const font = useMemo(
        () =>
            getComputedStyle(document.documentElement)
                .getPropertyValue('--font-plex-mono')
                .trim() || 'ui-monospace, monospace',
        [],
    );
    const sinceDraw = useRef(0);
    const glass = useRef<Mesh>(null);

    // Enter or Space presses start, while you're at the machine.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const s = useWorld.getState();
            if (s.seat !== 'lobby-arcade' || s.seatPhase !== 'seated' || e.repeat) return;
            if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
                e.preventDefault();
                machine.press();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useFrame(({ camera }, delta) => {
        const s = useWorld.getState();
        const playing = s.seat === 'lobby-arcade' && s.seatPhase === 'seated';
        if (!playing) {
            machine.abandon(); // walked away mid-game: back to the demo
            pad.left = pad.right = false;
        }
        // Nobody near: don't spend anything on it.
        if (!playing && camera.position.distanceTo(screenAt) > AWAKE_DISTANCE) return;

        const right = held('right') || pad.right ? 1 : 0;
        const left = held('left') || pad.left ? 1 : 0;
        machine.update(delta, playing ? right - left : 0);

        // Uploading a texture isn't free: the demo draws at 30 fps, a game at full rate.
        sinceDraw.current += delta;
        if (!playing && sinceDraw.current < 1 / 30) return;
        sinceDraw.current = 0;
        const prompt = !playing ? 'STEP UP TO PLAY' : s.touch ? 'TAP START' : 'PRESS ENTER';
        machine.draw(g, font, prompt);
        // Tell three.js the canvas changed (through the mesh: React's rules
        // keep values made during render, like the texture, read-only).
        const m = glass.current?.material as ShaderMaterial | undefined;
        if (m) m.uniforms.map.value.needsUpdate = true;
    });

    return (
        <OnFace at={GLASS_AT}>
            <mesh ref={glass} material={material}>
                <planeGeometry args={[GLASS.width, GLASS.height]} />
            </mesh>
        </OnFace>
    );
}

/** The control panel: a joystick that follows your steering, and buttons. */
function ControlPanel() {
    const stick = useRef<Group>(null);
    useFrame(() => {
        // Tilt toward the side you're steering, like a real stick under your hand.
        if (stick.current) stick.current.rotation.z = -machine.steer * 0.35;
    });

    const panel = face(POINT.panelFront, POINT.panelBack);
    return (
        // Turned so the group's +y is the panel's surface normal and +z points at you.
        <group position={[0, panel.y, panel.z]} rotation-x={panel.tilt + Math.PI / 2}>
            <mesh position-y={0.006} receiveShadow>
                <boxGeometry args={[WIDTH, 0.012, PANEL_FACE.length]} />
                <meshStandardMaterial color="#1c2a45" roughness={0.4} />
            </mesh>
            <group position={[-0.15, 0.012, 0.01]}>
                <mesh position-y={0.003}>
                    <cylinderGeometry args={[0.04, 0.04, 0.006, 24]} />
                    <meshStandardMaterial color="#0c0c0e" roughness={0.5} />
                </mesh>
                <group ref={stick}>
                    <mesh position-y={0.035} castShadow>
                        <cylinderGeometry args={[0.0065, 0.0065, 0.06, 12]} />
                        <meshStandardMaterial color="#c9ccd2" metalness={0.8} roughness={0.3} />
                    </mesh>
                    <mesh position-y={0.072} castShadow>
                        <sphereGeometry args={[0.021, 20, 14]} />
                        <meshStandardMaterial color="#d83a34" roughness={0.25} />
                    </mesh>
                </group>
            </group>
            {(
                [
                    [0.06, 0.02, '#ffd75e'],
                    [0.135, -0.005, '#5aa7d6'],
                    [-0.02, -0.085, '#e8e2d4'],
                ] as const
            ).map(([x, z, color]) => (
                <mesh key={color} position={[x, 0.016, z]} castShadow>
                    <cylinderGeometry args={[x < 0 ? 0.011 : 0.017, 0.019, 0.012, 20]} />
                    <meshStandardMaterial
                        color={color}
                        roughness={0.3}
                        emissive={color}
                        emissiveIntensity={0.15}
                    />
                </mesh>
            ))}
        </group>
    );
}

/** The coin door on the front: a steel plate with two lit coin slots. */
function CoinDoor() {
    return (
        <OnFace at={face(POINT.frontBottom, POINT.kickTop, 0.004)}>
            <group position-y={0.5 - KICK_FACE.y}>
                <mesh>
                    <boxGeometry args={[0.24, 0.27, 0.008]} />
                    <meshStandardMaterial color="#8d9096" metalness={0.85} roughness={0.35} />
                </mesh>
                {[-0.05, 0.05].map((x) => (
                    <group key={x} position={[x, 0.04, 0.005]}>
                        <mesh>
                            <boxGeometry args={[0.036, 0.06, 0.004]} />
                            <meshStandardMaterial color="#2a0a08" roughness={0.4} />
                        </mesh>
                        {/* the slot's light: the red glow arcades are known for */}
                        <mesh position-z={0.0025}>
                            <planeGeometry args={[0.026, 0.048]} />
                            <meshStandardMaterial
                                color="#000"
                                emissive="#ff3a24"
                                emissiveIntensity={2.2}
                            />
                        </mesh>
                        <mesh position={[0, 0, 0.003]}>
                            <planeGeometry args={[0.004, 0.032]} />
                            <meshBasicMaterial color="#000" />
                        </mesh>
                    </group>
                ))}
                {[-0.05, 0.05].map((x) => (
                    <mesh key={x} position={[x, -0.075, 0.005]}>
                        <boxGeometry args={[0.04, 0.03, 0.004]} />
                        <meshStandardMaterial color="#111" roughness={0.5} />
                    </mesh>
                ))}
            </group>
            {/* steel kick plate along the floor */}
            <mesh position-y={0.045 - KICK_FACE.y}>
                <boxGeometry args={[WIDTH, 0.09, 0.006]} />
                <meshStandardMaterial color="#5c5f66" metalness={0.8} roughness={0.4} />
            </mesh>
        </OnFace>
    );
}

// ---- Artwork, drawn once into canvases ------------------------------------

/**
 * The side art. An extruded shape's caps get UVs straight from the shape's
 * coordinates, in metres, so the texture's repeat and offset map the
 * profile's bounding box (z -0.42…0.47, y 0…1.9) onto the whole canvas.
 * The design is symmetric enough to read the same on both sides (one side
 * sees it mirrored), so there's no lettering on it.
 */
function drawSideArt() {
    const z0 = POINT.backBottom[0];
    const z1 = POINT.panelFront[0];
    const top = POINT.marqueeTop[1];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 1024);
    sky.addColorStop(0, '#1b1530');
    sky.addColorStop(0.6, '#121a2e');
    sky.addColorStop(1, '#0b0f1a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 1024);

    // Three bold stripes sweeping up from the front toward the back.
    g.lineCap = 'butt';
    const stripes: [string, number][] = [
        ['#c8463c', 0],
        [TRIM, 70],
        ['#ffd75e', 140],
    ];
    for (const [color, off] of stripes) {
        g.strokeStyle = color;
        g.lineWidth = 46;
        g.beginPath();
        g.moveTo(560, 760 - off);
        g.lineTo(-40, 300 - off);
        g.stroke();
    }

    // A big tyre, rolling out of the stripes.
    const cx = 250;
    const cy = 800;
    g.fillStyle = '#0a0a0c';
    g.beginPath();
    g.arc(cx, cy, 120, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#26272c';
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.save();
        g.translate(cx + Math.cos(a) * 112, cy + Math.sin(a) * 112);
        g.rotate(a);
        g.fillRect(-8, -9, 16, 18);
        g.restore();
    }
    g.fillStyle = '#c9ccd2';
    g.beginPath();
    g.arc(cx, cy, 52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8d9096';
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, 7, 0, Math.PI * 2);
        g.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.repeat.set(1 / (z1 - z0), 1 / top);
    texture.offset.set(-z0 / (z1 - z0), 0);
    return texture;
}

/** The marquee: the game's name on a backlit sign. */
function drawMarquee() {
    const w = 1024;
    const h = Math.round((w * MARQUEE_FACE.length) / WIDTH);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1b1530');
    bg.addColorStop(1, '#0b0f1a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // Sunset bands behind the title.
    const bands = ['#c8463c', TRIM, '#ffd75e'];
    bands.forEach((color, i) => {
        g.fillStyle = color;
        g.globalAlpha = 0.55;
        g.fillRect(0, h * 0.62 + i * 22, w, 12);
    });
    g.globalAlpha = 1;

    const css = getComputedStyle(document.documentElement);
    const display = css.getPropertyValue('--font-archivo').trim() || 'system-ui, sans-serif';
    // As big as fits: the title's height, or the sign's width less a margin.
    let size = Math.round(h * 0.42);
    g.font = `italic 900 ${size}px ${display}`;
    size = Math.floor(size * Math.min(1, (w * 0.88) / g.measureText('PUNCTURE RUN').width));
    g.font = `italic 900 ${size}px ${display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const title = g.createLinearGradient(0, h * 0.25, 0, h * 0.7);
    title.addColorStop(0, '#ffe08a');
    title.addColorStop(1, TRIM);
    g.lineWidth = 16;
    g.strokeStyle = '#0a0a0c';
    g.strokeText('PUNCTURE RUN', w / 2, h * 0.46);
    g.fillStyle = title;
    g.fillText('PUNCTURE RUN', w / 2, h * 0.46);

    // A thin chrome frame.
    g.strokeStyle = '#c9ccd2';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
