---
title: 'TIL: prompt caching'
kind: til
area: ai
summary: How a repeated prompt gets cheap, and the one rule that keeps it cached.
updated: 2026-11-27
---

When most of a prompt is the same on every request (instructions, documents, tool definitions), mark the end of that shared part as cacheable. The provider keeps it for a few minutes; requests in that window read it at a fraction of the input price and start answering sooner.

On the kiosk in this loft: the first question writes about 11,500 tokens to the cache, every question after that reads them, and only the ~20 new tokens of the question are billed in full.

The rule: caching matches the prompt's beginning **exactly**. A timestamp, a random ID or a shuffled list anywhere in the cached part makes every request a miss, silently. So stable content goes first, what changes per request goes last, and the usage numbers in the response tell you whether it's working.
