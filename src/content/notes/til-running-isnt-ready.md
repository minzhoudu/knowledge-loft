---
title: "TIL: running isn't ready"
kind: til
area: backend
summary: A game server's container can be running long before anyone can join it.
updated: 2026-11-27
---

Docker says a container is **running** as soon as its process starts. A game server then spends minutes downloading, installing and loading a world before anyone can join. Showing "running" during that time is a small lie, and it sent us chasing connection timeouts.

What I found:

- **Some images can tell you.** The popular Minecraft image (`itzg/minecraft-server`) ships a healthcheck that speaks Minecraft's own query protocol. Docker reports it as `health: starting`, then `healthy` once players can really connect.
- **Others can't.** The 7 Days to Die images define no healthcheck at all.

So the design for GameNest is a separate **"preparing"** status: running, but not yet confirmed ready. Use a real healthcheck where the image has one, and never claim "ready" without evidence. Not built yet, but it's next.
