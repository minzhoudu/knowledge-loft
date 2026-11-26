---
title: 'TIL: LinuxGSM for game servers'
kind: til
area: backend
summary: One tool that installs and runs about 180 different game servers.
updated: 2026-11-27
---

GameNest started with a different Docker image for each game, each with its own quirks. The 7 Days to Die one kept giving connection timeouts, because the server never finished setting itself up.

**LinuxGSM** is a long-running command-line tool that installs, configures, updates and starts dedicated game servers (through SteamCMD) in one standard way, for about **180 games**. It has an official, maintained Docker wrapper: `gameservermanagers/docker-gameserver`.

Switching the 7 Days to Die template to it (with `VERSION=stable`) fixed it: the server installs, comes up, and we can connect.

The lesson: before maintaining many per-game setups, look for the one tool the game-server community already standardised on.
