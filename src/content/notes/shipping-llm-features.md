---
title: Shipping LLM features
kind: note
area: ai
summary: What it takes to get an AI feature from a good demo to something people trust.
updated: 2026-11-27
---

I've built LLM features into real products, most recently an internal RAG assistant that answers questions over product documentation and analytics data on AWS Bedrock. The demo is the easy part. These are the things that decided whether people actually used it.

## Retrieval matters more than the model

Most bad answers were retrieval problems, not model problems: the right passage was never found, or it was cut in half by the chunking. Time spent on chunking, metadata and search quality paid off more than switching models.

## Show your sources

An answer with links to the documents it came from can be checked in seconds. Without them, one confident wrong answer and people stop trusting the whole tool.

## Keep a small test set

A list of real questions with known good answers, run after every prompt or retrieval change. Without it, every "improvement" is a guess.

## Budget latency and cost early

Streaming, caching and choosing a smaller model where a big one isn't needed are design decisions, not things to bolt on once the bill arrives.

## Allow "I don't know"

The assistant should be allowed, and told, to say it doesn't know when retrieval finds nothing relevant.
