---
title: How AI integrations work
kind: note
area: ai
summary: The moving parts behind "add AI to it", and how to choose between them.
updated: 2026-11-27
---

Under every AI feature is one HTTP request: send text to a model, get text back. Everything else is technique on top of that.

## The basics

- **Tokens.** Models read and write chunks of about three quarters of a word. You pay per token, separately for what you send and what comes back.
- **Stateless.** The model remembers nothing between requests. A conversation means sending the whole history every time, and paying for it again.
- **Context window.** How much the model can read in one request. Current models take a million tokens; most portfolios, docs or product catalogues fit with room to spare.
- **System prompt.** The instructions channel: who the model is, what it may use, what it must not do. Users can't overwrite it, but they can try to talk it out of it.
- **Streaming.** The answer arrives as it's written instead of all at once. It doesn't make the model faster, but it makes the feature feel fast.

## Giving a model knowledge

- **Put it all in the prompt.** The simplest and most reliable when the content fits: the model sees everything, so nothing can fail to be found. Prompt caching makes the repeated part cheap.
- **RAG** (retrieval-augmented generation). Split content into chunks, store them as embeddings, and send only the closest few per question. It scales to millions of documents, but every wrong answer is usually a retrieval miss. RAG is a workaround for content that doesn't fit.
- **Fine-tuning.** Training the model further. Good for a style or a format, wrong for facts: they go stale, and you'd retrain for every change.
- **Tools.** Describe functions to the model; it asks you to run one and continues with the result. This is how a model does things or fetches live data.
- **Agents.** A model chaining tool calls on its own toward a goal. Powerful for open-ended work, and slower, costlier and harder to control.

## SDK, abstraction or your own model

A provider's own SDK gives every feature first. An abstraction layer makes switching providers easy, at the cost of the features they don't share. Self-hosting an open model removes the per-token bill and adds GPUs and operations. Whichever you choose, the API key lives on the server, never in the browser.

## Picking a model

Start with the smallest model that answers well, and measure before moving up. For grounded Q&A over a few thousand words, a fast, cheap model is usually enough; the bigger ones earn their price on reasoning and long, multi-step work.
