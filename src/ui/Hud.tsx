"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWorld } from "@/store/world";
import { Section, SECTION_TITLES } from "./sections";

/** Ask the browser to capture the mouse on the 3D canvas (needs a user gesture). */
function enterWorld() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world canvas");
  // Chrome refuses a re-lock for ~1s after leaving lock; the rejection is harmless.
  Promise.resolve(canvas?.requestPointerLock()).catch(() => {});
}

/**
 * Everything 2D drawn over the canvas: start/pause screen, crosshair,
 * "Press E" prompt and content panels. It's plain DOM on purpose: text stays
 * crisp, selectable and accessible, which 3D text never is.
 */
export function Hud() {
  const mode = useWorld((s) => s.mode);
  const focused = useWorld((s) => s.focused);
  const openPanel = useWorld((s) => s.openPanel);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useWorld.getState();
      if (e.code === "KeyE" && s.mode === "exploring" && s.focused) {
        s.open(s.focused.id);
        document.exitPointerLock();
      } else if (e.code === "Escape" && s.mode === "reading") {
        s.close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {mode === "exploring" && (
        <>
          <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 size-1.5 -translate-1/2 rounded-full bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
          {focused && (
            <div className="pointer-events-none fixed left-1/2 top-[58%] -translate-x-1/2 rounded-lg bg-panel px-3 py-2 text-sm text-fg backdrop-blur">
              <kbd className="mr-2 rounded border border-line px-1.5 py-0.5 font-mono text-xs">E</kbd>
              {focused.label}
            </div>
          )}
        </>
      )}

      {(mode === "intro" || mode === "paused") && (
        <div className="fixed inset-0 grid place-items-center bg-black/35 px-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-panel p-6 text-fg backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Greybox · Lobby</p>
            <h1 className="font-display text-2xl font-bold">{mode === "intro" ? "Studio loft" : "Paused"}</h1>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              <li><Key>W A S D</Key> walk, <Key>Shift</Key> run</li>
              <li><Key>Mouse</Key> look around</li>
              <li><Key>E</Key> inspect the warm-coloured objects</li>
              <li><Key>Esc</Key> release the mouse</li>
            </ul>
            <button
              type="button"
              onClick={enterWorld}
              className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {mode === "intro" ? "Enter" : "Resume"}
            </button>
            <Link href="/quick" className="text-center text-sm text-muted underline-offset-4 hover:underline">
              Skip the tour: quick view
            </Link>
          </div>
        </div>
      )}

      {mode === "reading" && openPanel && (
        <div className="fixed inset-0 flex items-center justify-end bg-black/25 p-4" role="dialog" aria-modal="true" aria-labelledby="panel-title">
          <section className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-panel p-6 text-fg backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <h2 id="panel-title" className="font-display text-xl font-bold">{SECTION_TITLES[openPanel]}</h2>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  useWorld.getState().close();
                  enterWorld();
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                Back to walking
              </button>
            </div>
            <Section id={openPanel} />
          </section>
        </div>
      )}
    </>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-xs text-fg">{children}</kbd>;
}
