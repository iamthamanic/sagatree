# Debug Report — `atlas-levels4-room-anchor`

**Date:** 2026-10-17  
**Project:** sagatree  
**Shell:** web  
**Repro grade:** full  

---

## Summary

`updateRoomAnchor()` still wrote `levels[4].x` after the region LOD was removed, so `levels[4]` is `undefined` and mount throws before the atlas canvas/side panel render.  
**Confidence:** high

---

## Bug description

| | |
|--|--|
| **Expected** | Welt/Karte atlas mounts with map, nav layers, and tools panel |
| **Actual** | Red banner `Cannot set properties of undefined (setting 'x')`; empty ATLAS viewport; layers panel missing |
| **Steps** | 1. Open saga Welt → Karte 2. Atlas runtime mounts 3. Crash on first `updateRoomAnchor()` |

**First seen:** Immediately after Länder-tabs / region-removal change that shortened `levels` from 5 → 4 entries (`world, city, dungeon, room`).

---

## Reproduction

- **Command / URL:** `http://localhost:3004/sagas/SA-E979J/world/map` (Vite)
- **Playwright / CDP:** pageerror + `[role="alert"]` text matched exact TypeError
- **Result:** reproduced (100%)
- **Hard path:** no

---

## Evidence

### Console

```
TypeError: Cannot set properties of undefined (setting 'x')
  at updateRoomAnchor (atlas-prototype-runtime.mjs)
```

### Network

No 4xx/5xx related to mount — failure is synchronous JS before render completes.

### Screenshot

- User: `browser-screenshot-b31993a0-a646-4638-8af1-c6842b60e07b.png` (empty ATLAS + error banner)

---

## Prior art

- [x] Repo grep: `levels[4]` only in `updateRoomAnchor` (stale index after region drop)
- [x] `levels` array now: world / city / dungeon / room → room is index `3`, not `4`
- [ ] GitHub issue: n/a (local WIP regression)
- [ ] LightRAG: n/a

---

## Root cause

UI/runtime layer. When “Region” was removed from the LOD nav, `levels` lost one entry but `updateRoomAnchor` still assigned camera anchors via hard-coded `levels[4]`. That call runs during mount → uncaught TypeError → React error boundary / atlas shell alert → canvas + `#side` never paint.

**Hypotheses tested:** 1. `levels[4]` undefined after region removal — confirmed  
**Fix attempts this bug:** 1 (applied in same turn — user reported total breakage from our change)

---

## Suggested fix (minimal) — APPLIED

1. File: `src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs`
2. Change: resolve room by id: `levels.find(l => l.id === 'room')` + early return if missing; set `room.x` / `room.z`
3. Regression: assert no pageerror on atlas mount; optional self-test that `updateRoomAnchor` does not touch a numeric index

**Next step:** hard-reload Welt/Karte — atlas should mount again

---

## Notes

- Assumptions: Vite HMR / hard reload picks up runtime.mjs change
- Out of scope: Länder highlight / editable Weltkarte verification beyond mount recovery
