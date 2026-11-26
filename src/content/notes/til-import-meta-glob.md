---
title: 'TIL: import.meta.glob in Next.js'
kind: til
area: frontend
summary: Turbopack can import a whole folder of markdown files at build time.
updated: 2026-11-27
---

Next.js with Turbopack supports `import.meta.glob`, the Vite feature for importing every file that matches a pattern:

```ts
const files = import.meta.glob<string>('./notes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
```

Turbopack has no built-in `?raw`, so a rule in `next.config.ts` turns those imports into strings:

```ts
'*.md': { condition: { query: '?raw' }, type: 'text' }
```

This bookshelf is built that way: every book is a markdown file.
