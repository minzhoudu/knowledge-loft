---
title: Launching a SaaS for free
kind: note
area: craft
summary: Getting Moj Vulkanizer into production without paying anything up front, and knowing when that ends.
updated: 2026-11-27
---

I didn't want to spend money on Moj Vulkanizer before knowing whether anyone would pay for it. Here's how that turned out.

## The plan that didn't survive

The first plan was a small Hetzner server running Coolify (self-hosted, so no €5 a month for the hosted dashboard). Hetzner wanted a card, then an account verification before the first project, where the quick option was a prepayment. Reasonable for them, but money spent before I knew anything.

## What it runs on instead

- **Vercel's free Hobby plan** for the Next.js app: no card, deploys straight from GitHub.
- **Neon's free Postgres.** The app only needs a standard `DATABASE_URL`, so moving later is easy.
- **A Namecheap domain**, the one real cost.
- **Maps without Google:** MapLibre for the map, OpenFreeMap for the tiles and Photon for address search. All free, commercial use included. "Get directions" is a plain Google Maps link, which needs no key.

## Know where free ends

Vercel's Hobby plan is for non-commercial use only. The day shops start paying, the app moves to Pro. That's fine, as long as it's a known step and not a surprise.

## The rules I'd keep

- Keep everything portable: standard Postgres, a standard Next.js app, nothing tied to one host.
- Read the terms, not just the price.
- Spend money when there's revenue to spend.
