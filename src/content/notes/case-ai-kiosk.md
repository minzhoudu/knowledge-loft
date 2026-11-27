---
title: Building the loft's AI kiosk
kind: case
area: ai
summary: A kiosk in this loft that answers questions about me and can walk you to what it's talking about.
updated: 2026-11-27
---

## Context

Recruiters often want one answer, not a tour: has he led a team, what's his strongest project. The lobby kiosk answers in seconds, from the same content the rooms are built from.

## Approach

- **Everything in the prompt, no RAG.** The whole portfolio, notes included, is about 11,500 tokens. It's generated from the site's content on every server start, so a new project is something the kiosk knows straight away, and nothing can fail to be found.
- **A small, fast model.** Short, grounded answers don't need a big model. Thinking is off and effort is low, so answers start quickly.
- **Prompt caching.** The instructions, tools and portfolio are the same on every request, so they're cached. The first question writes 11,500 tokens to the cache; the next ones read them at a fraction of the price, and only about 20 new tokens are billed in full.
- **Streaming.** The answer is typed out on the kiosk's screen as it's written.
- **Tools for "take me there".** Three tools take visitors to a room, an exhibit or a role. Their inputs are fixed lists of real places, and the server validates every call before acting. The stream carries both text and actions, one JSON event per line.

## Guarding a public endpoint

- **Cost.** A per-visitor rate limit, a daily cap and a cap on answer length. The rate limit lives in memory, so on serverless it's soft; the monthly spend limit at the provider is the hard one.
- **Prompt injection.** "Ignore your instructions" gets a polite refusal. The real protection is that the kiosk has no secrets and no dangerous tools: the worst case is an off-topic reply.
- **Hallucination.** It answers only from the portfolio and says when it doesn't know, pointing to the CV instead of guessing salaries or dates.
- **Refusals.** A refused answer is never acted on, in case it was cut off mid-tool-call.

## Result

Accurate, short answers with directions to the right room, a fraction of a cent per question, and a camera that flies you to the exhibit you asked about.

## What I'd keep

Tool descriptions are how you steer a model. One of my projects shares its name with an employer, and "take me to that exhibit" first went to the job instead. One line in the description, "exhibit means a project", fixed it.
