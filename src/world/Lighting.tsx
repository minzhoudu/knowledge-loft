"use client";

import { ROOM } from "@/world/rooms/lobby/layout";

/**
 * Greybox lighting: just enough to read shapes.
 * - Hemisphere light: cheap ambient fill, sky colour from above, ground colour from below.
 * - Directional light: the sun, coming in through the window wall (+z) and casting shadows.
 *   Its shadow camera is an orthographic box; we size it to just cover the room,
 *   because a bigger box spreads the same shadow-map pixels over more area (blurrier shadows).
 */
export function Lighting() {
  const s = Math.max(ROOM.halfWidth, ROOM.halfDepth) + 3;
  return (
    <>
      <hemisphereLight args={["#e8eef5", "#8a8178", 2.0]} />
      <directionalLight
        position={[5.5, 6.5, 14]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
    </>
  );
}
