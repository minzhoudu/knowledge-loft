---
title: 'TIL: fixed bodies ignore rotation'
kind: til
area: frontend
summary: A react-three-rapier fixed body applies its rotation to physics, not to what you see.
updated: 2026-11-27
---

In `@react-three/rapier`, a `<RigidBody type="fixed" rotation={...}>` passes the rotation to the physics body, but a fixed body never writes its transform back to the rendered object. The collider turns; the model doesn't.

Fix: put the position and rotation on a plain `<group>` around the rigid body. The body reads its parent's world transform when it's created, so the visual and the collider stay together.
