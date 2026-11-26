# Knowledge Loft

A portfolio you walk through: a first-person studio loft where each room and object holds part of the story (projects, career, hobbies, about me). A plain 2D quick view at `/quick` shows the same content.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Add `?debug` to the URL to see every physics collider as a wireframe.

## Stack

| Concern           | Choice                                     |
| ----------------- | ------------------------------------------ |
| App               | Next.js (App Router), TypeScript, Tailwind |
| 3D                | three.js via React Three Fiber + drei      |
| Physics / walking | Rapier (`@react-three/rapier`)             |
| World state       | Zustand                                    |
| Content           | Typed data validated with Zod              |

## Layout

```
src/
  app/                 routes: / (3D world), /quick (2D view)
  content/             schema.ts (Zod), data.ts (your content), index.ts (validated exports)
  store/world.ts       mode, focused object, open panel
  ui/                  DOM overlays: HUD, panels, shared content sections
  world/
    Experience.tsx     the <Canvas>, physics, controls
    player/            first-person capsule + key bindings
    interaction/       Interactable registry + crosshair raycast
    greybox/           placeholder building blocks
    rooms/lobby/       layout.ts (dimensions + markers) and the greybox room
```

## Principles

- **One content source.** The 3D panels, the quick view and (later) the AI assistant all read `src/content`.
- **Gameplay is separate from visuals.** Colliders, spawn points and exhibit positions come from `layout.ts` markers, not from the models, so art can be upgraded without touching code.
- **Greybox first, art later.** Rooms are plain boxes until the layout feels right.
