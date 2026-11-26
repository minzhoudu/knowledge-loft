'use client';

import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import {
    AdditiveBlending,
    CanvasTexture,
    Color,
    Matrix4,
    SRGBColorSpace,
    type Group,
    type InstancedMesh,
    type LineSegments,
    type SpriteMaterial,
} from 'three';
import type { SkillCategory } from '@/content';
import { useWorld } from '@/store/world';
import { Interactable } from '@/world/interaction/Interactable';
import { surfaceProps } from '@/world/materials/surfaces';
import { MARKERS } from '@/world/rooms/lobby/layout';
import { constellation, neighbours, strongest } from './layout';

/**
 * The skill constellation: the lobby's centrepiece.
 *
 * One star per skill, sized by how many projects and roles use it, coloured
 * by family, and linked to the skills it was used alongside. Look at a star
 * and it lights up with its links and their names; press E for the projects
 * and roles behind it.
 *
 * Rendering is cheap on purpose:
 * - all stars are ONE draw call (an InstancedMesh: one sphere, drawn N times
 *   with a per-instance position, size and colour),
 * - all links are ONE draw call (LineSegments: pairs of points),
 * - star colours go above 1.0 ("brighter than white"), which is exactly what
 *   the bloom pass picks up, so they glow without any light sources.
 */

const { stars, links } = constellation;
const N = stars.length;

const [CX, , CZ] = MARKERS.constellation.position;
const CENTRE_Y = 2.15; // middle of the cloud, a little above eye height
const RADIUS = 1.35; // metres
const SPIN = 0.035; // radians per second: a slow drift, so it feels alive

const CATEGORY_COLOR: Record<SkillCategory, string> = {
    language: '#f2c14e',
    frontend: '#5ec8f2',
    backend: '#7ee08a',
    data: '#c79bff',
    devops: '#ff9f6b',
    ai: '#ff6fa8',
    commerce: '#9ad1c3',
};

const baseColor = stars.map((s) => new Color(CATEGORY_COLOR[s.category]));
const size = stars.map((s) => 0.024 + 0.014 * Math.sqrt(s.uses));
const world = stars.map((s) => s.position.map((v) => v * RADIUS) as [number, number, number]);

// Link geometry: two points per link, and a colour per point (updated per frame).
const linkPositions = new Float32Array(links.length * 6);
const linkColors = new Float32Array(links.length * 6);
links.forEach(({ a, b }, i) => {
    linkPositions.set(world[a], i * 6);
    linkPositions.set(world[b], i * 6 + 3);
});

const starColors = new Float32Array(N * 3);

// Per-frame state (module scope: written by the render loop, never by React).
const glow = new Float32Array(N).fill(1); // current brightness of each star
const tint = new Color();
const matrix = new Matrix4();
const spin = { angle: 0, speed: SPIN };

/** How bright each star wants to be: busier skills shine more. */
function restingGlow(i: number) {
    return 0.9 + 0.35 * Math.sqrt(stars[i].uses);
}

export function SkillConstellation() {
    const group = useRef<Group>(null);
    const starMesh = useRef<InstancedMesh>(null);
    const linkLines = useRef<LineSegments>(null);
    const labels = useRef<(SpriteMaterial | null)[]>([]);
    const labelTextures = useMemo(() => stars.map((s) => drawLabel(s.name)), []);

    useEffect(() => () => labelTextures.forEach((l) => l.texture.dispose()), [labelTextures]);

    // Place every star instance once; only colours change after this.
    useEffect(() => {
        const mesh = starMesh.current;
        if (!mesh) return;
        world.forEach((p, i) => {
            matrix.makeScale(size[i], size[i], size[i]).setPosition(...p);
            mesh.setMatrixAt(i, matrix);
            mesh.setColorAt(i, baseColor[i]);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, []);

    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.1);
        const focusedId = useWorld.getState().focused?.id;
        const focus = focusedId?.startsWith('skill:')
            ? stars.findIndex((s) => `skill:${s.slug}` === focusedId)
            : -1;
        const near = focus >= 0 ? new Set(neighbours[focus]) : null;
        const named = focus >= 0 ? new Set(strongest[focus]) : null; // the ones we name

        // Hold still while you're looking at a star, so it doesn't drift away.
        spin.speed += ((focus >= 0 ? 0 : SPIN) - spin.speed) * (1 - Math.exp(-3 * dt));
        spin.angle += spin.speed * dt;
        if (group.current) group.current.rotation.y = spin.angle;

        // Stars: the focused one blazes, its neighbours brighten, the rest fade back.
        const ease = 1 - Math.exp(-8 * dt);
        const mesh = starMesh.current;
        for (let i = 0; i < N; i++) {
            const target = focus < 0 ? restingGlow(i) : i === focus ? 6 : near!.has(i) ? 2.6 : 0.35;
            glow[i] += (target - glow[i]) * ease;
            if (mesh) mesh.setColorAt(i, tint.copy(baseColor[i]).multiplyScalar(glow[i]));

            const label = labels.current[i];
            if (label) {
                const show =
                    focus < 0
                        ? stars[i].uses >= 3
                            ? 0.8
                            : 0
                        : i === focus || named!.has(i)
                          ? 1
                          : 0;
                label.opacity += (show - label.opacity) * ease;
                label.visible = label.opacity > 0.01;
            }
        }
        if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Links: faint threads normally; the focused star's links light up.
        const lines = linkLines.current;
        if (lines) {
            const colors = lines.geometry.attributes.color;
            links.forEach(({ a, b, weight }, i) => {
                const lit = focus >= 0 && (a === focus || b === focus);
                const strength =
                    (focus < 0 ? 0.08 : lit ? 0.9 : 0.02) * Math.min(1, 0.5 + weight * 0.25);
                tint.copy(baseColor[a]).multiplyScalar(strength);
                colors.setXYZ(i * 2, tint.r, tint.g, tint.b);
                tint.copy(baseColor[b]).multiplyScalar(strength);
                colors.setXYZ(i * 2 + 1, tint.r, tint.g, tint.b);
            });
            colors.needsUpdate = true;
        }
    });

    const steel = surfaceProps('metal');
    return (
        <group>
            {/* the projector it floats above: a low steel drum with a glowing rim */}
            <RigidBody type="fixed" colliders={false} position={[CX, 0, CZ]}>
                <CylinderCollider args={[0.16, 0.6]} position={[0, 0.16, 0]} />
                <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.6, 0.64, 0.32, 48]} />
                    <meshStandardMaterial {...steel} />
                </mesh>
                <mesh position={[0, 0.325, 0]} rotation-x={-Math.PI / 2}>
                    <ringGeometry args={[0.5, 0.53, 64]} />
                    <meshBasicMaterial color={[1.6, 1.9, 2.4]} />
                </mesh>
            </RigidBody>

            <group ref={group} position={[CX, CENTRE_Y, CZ]}>
                <instancedMesh
                    ref={starMesh}
                    args={[undefined, undefined, N]}
                    frustumCulled={false}
                >
                    {/* Created up front so the shader is compiled with per-instance colour. */}
                    <instancedBufferAttribute attach="instanceColor" args={[starColors, 3]} />
                    <sphereGeometry args={[1, 16, 12]} />
                    <meshBasicMaterial />
                </instancedMesh>

                <lineSegments ref={linkLines} frustumCulled={false}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} />
                        <bufferAttribute attach="attributes-color" args={[linkColors, 3]} />
                    </bufferGeometry>
                    <lineBasicMaterial
                        vertexColors
                        transparent
                        depthWrite={false}
                        blending={AdditiveBlending}
                    />
                </lineSegments>

                {stars.map((s, i) => (
                    <group key={s.slug} position={world[i]}>
                        {/* A bigger invisible ball around each star, so it's easy to aim at.
                            Invisible meshes still answer raycasts. */}
                        <Interactable
                            id={`skill:${s.slug}`}
                            label={`${s.name} · ${usesLabel(s.uses)}`}
                            action={{ kind: 'panel', panel: { kind: 'skill', slug: s.slug } }}
                        >
                            <mesh visible={false} userData={{ aimAssist: true }}>
                                <sphereGeometry args={[Math.max(0.1, size[i] * 2.5), 8, 6]} />
                            </mesh>
                        </Interactable>
                        <sprite
                            position={[0, size[i] + 0.05, 0]}
                            scale={[0.08 * labelTextures[i].aspect, 0.08, 1]}
                        >
                            <spriteMaterial
                                ref={(m) => {
                                    labels.current[i] = m;
                                }}
                                map={labelTextures[i].texture}
                                transparent
                                opacity={0}
                                depthWrite={false}
                            />
                        </sprite>
                    </group>
                ))}
            </group>
        </group>
    );
}

function usesLabel(uses: number) {
    if (uses === 0) return 'skill';
    return `${uses} ${uses === 1 ? 'project or role' : 'projects and roles'}`;
}

/** A star's name as a texture: white text with a soft shadow, so it reads on any background. */
function drawLabel(text: string) {
    const font = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-plex-mono')
        .trim();
    const px = 56;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d')!;
    g.font = `500 ${px}px ${font || 'ui-monospace, monospace'}`;
    const width = Math.ceil(g.measureText(text).width) + 24;
    canvas.width = width;
    canvas.height = px + 24;
    g.font = `500 ${px}px ${font || 'ui-monospace, monospace'}`;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0, 0, 0, 0.8)';
    g.shadowBlur = 10;
    g.fillStyle = '#ffffff';
    g.fillText(text, 12, canvas.height / 2);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, aspect: canvas.width / canvas.height };
}
