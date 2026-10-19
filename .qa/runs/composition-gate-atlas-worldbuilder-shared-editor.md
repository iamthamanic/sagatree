# Composition Gate — atlas-worldbuilder-shared-editor

- HEAD_SHA: f79aee4a332fca21011fd6c751f09f133f7ba1a3
- BASE_SHA: 4ae66b1fc5fc5c58940e3d347760c17aeb7f9e29
- Date: 2026-10-19
- Verdict: CLEAR

## Event

GM edits WebGL props on a product map; runtime persists into React dirty state; save upserts `generator_meta.webglRuntimeV3` with map revision CAS. Draufsicht reads the same object IDs from `UnifiedCanvasDoc`.

## Hop chain

1. Producer: WebGL `persist()` / `onPersist` → `updateWebglRuntime` + `syncWebglPropsIntoCanvasDoc`
2. Consumer A: `saveCanvas` → `mergeWebglRuntimeIntoGeneratorMeta` → `upsert_world_atlas_map` (expectedRevision)
3. Consumer B: map reload → `extractWebglRuntimeFromGeneratorMeta` → controlled `seedState` remount

## Simulations

- N-actors: two editors save same map → revision mismatch surfaces error (no silent last-write-wins).
- Invalid/missing: controlled + empty seed does not fall back to localStorage SoT; parse rejects incomplete runtime blobs.
- Two consumers / crash: mid-save failure leaves dirty flag + explicit Speichern/Retry; no false “saved” from localStorage.

## Flags

(none)
