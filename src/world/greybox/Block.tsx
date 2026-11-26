"use client";

import { useIsFocused } from "@/world/interaction/Interactable";

type Vec3 = [number, number, number];

export const GREY = {
  floor: "#b9bcbf",
  wall: "#d9dbdd",
  ceiling: "#e4e5e6",
  furniture: "#9aa0a6",
  dark: "#5b6168",
  plant: "#7fa07a",
  interactive: "#d9a066", // anything you can inspect is tinted warm
} as const;

type Props = {
  size: Vec3;
  position: Vec3;
  color?: string;
  rotationY?: number;
};

/**
 * A greybox building block: just a box with a flat colour.
 * Inside an <Interactable>, it glows softly while the player looks at it.
 */
export function Block({ size, position, color = GREY.furniture, rotationY = 0 }: Props) {
  const focused = useIsFocused();
  return (
    <mesh position={position} rotation-y={rotationY} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        emissive={color}
        emissiveIntensity={focused ? 0.35 : 0}
      />
    </mesh>
  );
}
