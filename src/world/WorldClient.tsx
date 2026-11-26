"use client";

import dynamic from "next/dynamic";

/**
 * Client-only entry for the 3D world. `ssr: false` must live in a Client
 * Component, and it keeps three.js, R3F and Rapier out of the server render
 * and out of the initial HTML; they download as a separate chunk.
 */
const Experience = dynamic(() => import("./Experience"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center font-mono text-xs uppercase tracking-widest text-muted">
      Loading the loft…
    </div>
  ),
});

export function WorldClient() {
  return (
    <div id="world">
      <Experience />
    </div>
  );
}
