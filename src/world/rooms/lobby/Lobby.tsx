"use client";

import { Grid } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Block, GREY } from "@/world/greybox/Block";
import { Interactable } from "@/world/interaction/Interactable";
import { DOORS, MARKERS, ROOM, WINDOW } from "./layout";

const { halfWidth: X, halfDepth: Z, height: H, wall: T } = ROOM;

/**
 * Greybox lobby: the whole room from plain boxes.
 *
 * Everything inside the fixed <RigidBody colliders="cuboid"> gets an
 * automatic box collider generated from each mesh. Invisible
 * <CuboidCollider>s block the window and the not-yet-built doorways.
 * Decoration that you shouldn't bump into (window mullions, rug) sits
 * outside the rigid body, so it has no collision at all.
 */
export function Lobby() {
  const left = DOORS.projects;
  const back = DOORS.career;
  const lz0 = left.center - left.width / 2;
  const lz1 = left.center + left.width / 2;
  const bx0 = back.center - back.width / 2;
  const bx1 = back.center + back.width / 2;

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        {/* floor + ceiling */}
        <Block size={[X * 2 + T * 2, 0.2, Z * 2 + T * 2]} position={[0, -0.1, 0]} color={GREY.floor} />
        <Block size={[X * 2 + T * 2, 0.2, Z * 2 + T * 2]} position={[0, H + 0.1, 0]} color={GREY.ceiling} />

        {/* back wall (z = -Z) with the Career doorway */}
        <Wall from={[-X - T, -Z - T / 2]} to={[bx0, -Z - T / 2]} axis="x" />
        <Wall from={[bx1, -Z - T / 2]} to={[X + T, -Z - T / 2]} axis="x" />
        <Block size={[back.width, H - back.height, T]} position={[back.center, (H + back.height) / 2, -Z - T / 2]} color={GREY.wall} />

        {/* left wall (x = -X) with the Projects doorway */}
        <Wall from={[-X - T / 2, -Z]} to={[-X - T / 2, lz0]} axis="z" />
        <Wall from={[-X - T / 2, lz1]} to={[-X - T / 2, Z]} axis="z" />
        <Block size={[T, H - left.height, left.width]} position={[-X - T / 2, (H + left.height) / 2, left.center]} color={GREY.wall} />

        {/* right wall (x = +X) */}
        <Wall from={[X + T / 2, -Z]} to={[X + T / 2, Z]} axis="z" />

        {/* window wall (z = +Z): solid around one big opening */}
        <Wall from={[-X - T, Z + T / 2]} to={[WINDOW.x0, Z + T / 2]} axis="x" />
        <Wall from={[WINDOW.x1, Z + T / 2]} to={[X + T, Z + T / 2]} axis="x" />
        <Block size={[WINDOW.x1 - WINDOW.x0, WINDOW.y0, T]} position={[0, WINDOW.y0 / 2, Z + T / 2]} color={GREY.wall} />
        <Block size={[WINDOW.x1 - WINDOW.x0, H - WINDOW.y1, T]} position={[0, (H + WINDOW.y1) / 2, Z + T / 2]} color={GREY.wall} />

        <Furniture />
      </RigidBody>

      {/* invisible blockers: the window, and doorways until their rooms exist */}
      <CuboidCollider args={[(WINDOW.x1 - WINDOW.x0) / 2, (WINDOW.y1 - WINDOW.y0) / 2, T / 2]} position={[0, (WINDOW.y0 + WINDOW.y1) / 2, Z + T / 2]} />
      <CuboidCollider args={[T / 2, left.height / 2, left.width / 2]} position={[-X - T / 2, left.height / 2, left.center]} />
      <CuboidCollider args={[back.width / 2, back.height / 2, T / 2]} position={[back.center, back.height / 2, -Z - T / 2]} />

      {/* dark "coming soon" fills in the doorways */}
      <mesh position={[-X - T / 2, left.height / 2, left.center]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[left.width, left.height]} />
        <meshBasicMaterial color={GREY.dark} />
      </mesh>
      <mesh position={[back.center, back.height / 2, -Z - T / 2]}>
        <planeGeometry args={[back.width, back.height]} />
        <meshBasicMaterial color={GREY.dark} />
      </mesh>

      <WindowMullions />

      {/* 1 m grid on the floor, so you can judge scale while walking */}
      <Grid
        args={[X * 2, Z * 2]}
        position={[0, 0.002, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#9ea3a8"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#80868c"
        fadeDistance={40}
      />
    </group>
  );
}

/** A full-height wall segment between two points on the floor plan. */
function Wall({ from, to, axis }: { from: [number, number]; to: [number, number]; axis: "x" | "z" }) {
  const length = axis === "x" ? to[0] - from[0] : to[1] - from[1];
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const size: [number, number, number] = axis === "x" ? [length, H, T] : [T, H, length];
  return <Block size={size} position={[cx, H / 2, cz]} color={GREY.wall} />;
}

function WindowMullions() {
  const cols = 12;
  const rows = 4;
  const w = WINDOW.x1 - WINDOW.x0;
  const h = WINDOW.y1 - WINDOW.y0;
  const z = Z + 0.05;
  return (
    <group>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <Block key={`v${i}`} size={[0.05, h, 0.06]} position={[WINDOW.x0 + (i * w) / cols, WINDOW.y0 + h / 2, z]} color={GREY.dark} />
      ))}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <Block key={`h${j}`} size={[w, 0.05, 0.06]} position={[0, WINDOW.y0 + (j * h) / rows, z]} color={GREY.dark} />
      ))}
    </group>
  );
}

function Furniture() {
  const [dx, , dz] = MARKERS.desk.position;
  const [sx, , sz] = MARKERS.shelf.position;
  const [px, , pz] = MARKERS.plinth.position;
  const [ex, ey, ez] = MARKERS.screen.position;
  const [fx, , fz] = MARKERS.sofa.position;
  const [tx, , tz] = MARKERS.coffeeTable.position;
  const I = GREY.interactive;

  return (
    <>
      {/* desk corner: About me */}
      <Interactable id="about" label="Desk · About me">
        <Block size={[1.9, 0.04, 0.8]} position={[dx, 0.74, dz]} color={I} />
        <Block size={[0.04, 0.72, 0.7]} position={[dx - 0.85, 0.36, dz]} color={I} />
        <Block size={[0.04, 0.72, 0.7]} position={[dx + 0.85, 0.36, dz]} color={I} />
        <Block size={[0.96, 0.56, 0.03]} position={[dx, 1.15, dz - 0.17]} color={GREY.dark} />
      </Interactable>
      <Block size={[0.5, 0.9, 0.5]} position={[dx, 0.45, dz + 0.75]} />

      {/* bookshelf: Hobbies */}
      <Interactable id="hobbies" label="Bookshelf · Hobbies">
        <Block size={[0.03, 2.5, 0.38]} position={[sx - 1.2, 1.25, sz]} color={I} />
        <Block size={[0.03, 2.5, 0.38]} position={[sx + 1.2, 1.25, sz]} color={I} />
        {[0.12, 0.62, 1.12, 1.62, 2.12].map((y) => (
          <Block key={y} size={[2.4, 0.03, 0.38]} position={[sx, y, sz]} color={I} />
        ))}
      </Interactable>

      {/* wall screen: Career */}
      <Interactable id="career" label="Screen · Career">
        <Block size={[2.36, 1.38, 0.05]} position={[ex, ey, ez]} color={I} />
      </Interactable>

      {/* plinth: Projects */}
      <Interactable id="projects" label="Exhibit · Projects">
        <Block size={[0.62, 1.05, 0.62]} position={[px, 0.525, pz]} color={I} />
        <Block size={[0.5, 0.5, 0.5]} position={[px, 1.33, pz]} color="#e9d2b8" />
      </Interactable>

      {/* lounge */}
      <Block size={[2.6, 0.45, 0.95]} position={[fx, 0.225, fz]} />
      <Block size={[2.6, 0.5, 0.22]} position={[fx, 0.7, fz + 0.37]} />
      <Block size={[1.2, 0.45, 0.65]} position={[tx, 0.225, tz]} />

      {MARKERS.plants.map(([x, , z]) => (
        <Block key={`${x},${z}`} size={[0.5, 1.4, 0.5]} position={[x, 0.7, z]} color={GREY.plant} />
      ))}
    </>
  );
}
