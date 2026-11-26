---
title: 'TIL: every click needs feedback'
kind: til
area: frontend
summary: Why switching days in a Next.js schedule looked broken, and the fix.
updated: 2026-11-27
---

In production, switching days in Moj Vulkanizer's schedule changed nothing on screen until the next day's data arrived. It worked; it just felt broken.

`loading.tsx` shows instantly when you navigate to another page. It doesn't reliably show when only the **search params** change on the same page, like `?day=2026-11-28`.

The fix: navigate inside `useTransition`, and use its pending flag:

```tsx
const [pending, startTransition] = useTransition();
const go = (day: string) => startTransition(() => router.push(`?day=${day}`));
```

While `pending` is true, show a spinner and dim the old content. Buttons that call server actions get disabled, with "…" text while they wait.

Looking into it also showed that four of the six settings pages ran the same database query twice per click. Fixing that sped things up for real.

Now it's a rule: anything that waits on the server shows feedback the moment you click.
