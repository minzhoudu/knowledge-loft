---
title: React apps that survive growth
kind: note
area: frontend
summary: The habits that keep a React codebase pleasant once it has many features and many people.
updated: 2026-11-27
---

Most React codebases don't fail because of React. They fail because nobody can find anything, and every change breaks something far away. What helps:

## Organise by feature

Keep a feature's components, hooks, API calls and types together. A folder you can delete is a feature with clear edges.

## Keep server state and UI state apart

Data from the API lives in a cache layer; UI state stays local to where it's used. Global state is the exception, kept small and named well.

## Types at the edges

Validate what comes from the network once, at the boundary, then trust the types inside.

## Design components for their states

Loading, empty and error are props and stories too, not afterthoughts.

## Measure before optimising

Profile first, then memoise. Most slowness is too much rendering or too much JavaScript, and both are visible in the tools.
