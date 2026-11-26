---
title: 'Case: a 3D portfolio on a laptop'
kind: case
area: frontend
summary: Building this loft so it looks real and still runs smoothly in a browser.
updated: 2026-11-27
---

**Project:** Knowledge Loft, the place you're standing in.

## The problem

A walkable 3D space with real furniture, live sun and weather, and sound, that loads quickly and runs smoothly on an ordinary laptop, not just a gaming PC.

## The approach

- **Real models, made small.** Free models from Poly Haven and Sketchfab go through a build script that merges meshes, simplifies dense ones, resizes textures to WebP and compresses geometry with meshopt: 53 MB of sources became about 8 MB.
- **Few draw calls.** Hundreds of stars and LEDs are one instanced mesh each. Small props don't cast shadows.
- **Light that follows the real sky.** The sun is computed for Novi Sad's actual time and date, and the sky is captured into an environment map every half second, so reflections change with the weather.
- **Sound with no files.** Rain, wind, birds and footsteps are synthesised with the Web Audio API.
- **Text stays text.** Screens and books show real HTML placed in 3D, so it's sharp and its links work.

## Result

Around 300 draw calls per frame, smooth on a laptop, and every room is built from data.
