---
title: 'TIL: Esc and pointer lock'
kind: til
area: frontend
summary: Why pressing Esc to resume a browser game kept failing, and the fix.
updated: 2026-11-27
---

When a visitor presses **Esc**, the browser releases the mouse, and Chrome then **refuses to capture it again for about a second**. If the page releases it itself (`document.exitPointerLock()`), it may capture it again whenever it likes.

Second catch: requesting the lock on Esc **keydown** loses a race, because the browser handles that same Esc right after the page and releases the lock again. Requesting it on **keyup** works.

So: release the mouse yourself whenever you can, and resume on keyup.
