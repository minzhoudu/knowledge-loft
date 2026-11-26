---
title: Owning features end to end
kind: note
area: craft
summary: Why I like building a feature from the database to the last pixel, and how I go about it.
updated: 2026-11-27
---

I'm happiest owning a feature across the whole stack: the schema, the API, the UI and the deploy. A few habits make that work:

1. **Start from the data.** Get the model and its constraints right first. A rule the database enforces can't be broken by a bug in the UI.
2. **Make the API boring.** Predictable names, typed contracts, errors that say what went wrong.
3. **Build the UI around real states.** Loading, empty, error and "too much data" are designed in from the start, not discovered in production.
4. **Ship small, behind a flag if needed.** A thin slice in production teaches more than a perfect branch.
5. **Leave it observable.** Logs and metrics that answer "is it working?" without reading the code.

The benefit is that there are no hand-offs to lose context in. The risk is going deep on one layer for too long, so I timebox.
