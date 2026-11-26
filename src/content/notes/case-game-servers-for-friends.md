---
title: 'Case: game servers for friends'
kind: case
area: backend
summary: GameNest, a dashboard that starts game servers for my friends and me in a few clicks.
updated: 2026-11-27
---

**Project:** GameNest, a personal project in progress.

## The problem

My friends and I play survival and co-op games. Setting up a dedicated server each time means installing, configuring, opening ports and remembering how it all worked last time. I wanted a dashboard: pick a game, click, and get an address to share. It should run on my own PC now and in the cloud later, and maybe one day other people would pay for it.

## The approach

The key decision was to **split the control plane from the node agent**, the same way Pterodactyl (panel and wings) and Kubernetes (control plane and kubelet) are built:

- **Control plane:** a NestJS API with Postgres (through Prisma) and a React dashboard. It knows who owns what.
- **Node agent:** a small NestJS service on each machine that runs servers, using Docker through `dockerode`. It's deliberately simple.
- **The agent dials out.** It opens a WebSocket to the API, registers with a token and sends a heartbeat every 15 seconds. Because the connection starts from the agent, a home PC behind a router works the same as a cloud machine.
- **Typed end to end.** A `shared-types` package holds the WebSocket protocol, so the API and the agent can't disagree about a message (a pnpm and Turborepo monorepo).

## Games are data

Each game is a **template**: a Docker image, its ports, settings and defaults. Adding a game means adding a template, not writing code. Minecraft and 7 Days to Die work today, with port allocation so several servers can share one machine, a restart button, and email or Google sign-in.

## Where it stands

It works for us. Next on the list: an honest "preparing" status and, eventually, the cloud.
