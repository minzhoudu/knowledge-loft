---
title: 'TIL: focus scrolls hidden boxes'
kind: til
area: frontend
summary: Focusing an input scrolls its containers into view, even ones with overflow hidden.
updated: 2026-11-27
---

The kiosk's chat sits on a 3D screen: HTML placed with a CSS 3D transform. With an input inside, the whole screen vanished, drawn about 200,000 px away.

The maths was right. The cause: `input.focus()` scrolls every container needed to bring the input into view, including containers with `overflow: hidden`, which you can't scroll by hand. One wrapper got scrolled 519 px, and the 3D placement went with it.

Fix: `focus({ preventScroll: true })`, plus a capture-phase `scroll` listener that sets any container around the chat back to `scrollTop = 0`, because clicking into the box or typing can trigger the same scroll.
