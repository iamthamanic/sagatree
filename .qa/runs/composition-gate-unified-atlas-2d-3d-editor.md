# Composition Gate — unified-atlas-2d-3d-editor

- HEAD_SHA: 8b47fd4722e4794ec3d36eba96041cf1c2bd350f
- BASE_SHA: 8485f6d7f2d98af0a817b2f112281531197f3966
- Date (UTC): 2026-10-17T11:16:00Z
- Verdict: CLEAR

## Event

Hybrid Unified Atlas: Canvas2D Draufsicht + Three.js 3D share `UnifiedCanvasDoc`.
Dungeon Forge MIT extract with confirm + `manualDirty` reforge guard. Fokusmodus.
Shipped with Donalu places on the same PR tip.

## Hop chain

1. Editor loads map → `extractUnifiedCanvasFromGeneratorMeta`.
2. User edits 2D or 3D → `applyMapEdit` / `onDocChange`.
3. Save → `mergeUnifiedCanvasIntoGeneratorMeta` (+ dungeon meta).
4. Reload → same IDs/geometry.
5. Player get_map → layers secret-strip + generatorMeta engine-only.

## Simulations

### N-actors
- One GM editor session; second tab would hit revision conflict on save.

### Invalid/missing
- Missing detail place → IV placeholder CTA (no invented lore geometry).
- Reforge after confirm → explicit browser confirm.

### Two consumers / crash
- Draufsicht and 3D are two consumers of one doc; crash before save loses dirty buffer only.

## Flags

- Full product E2E 3D save/reload still manual.
- Demo rect LOD not replaced by full DB nested zoom.
