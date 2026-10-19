# Composition Gate — atlas-worldbuilder-shared-editor

## Feature slug
`atlas-worldbuilder-shared-editor` (#721)

## HEAD
WORKTREE matches `feat/atlas-worldbuilder-721` tip (feature commit `f79aee4a` + composition pins)

## Producer → consumer

1. `generator_meta.webglRuntimeV3` (DB map upsert) → `useWorldAtlasEditor` extract → `UnifiedAtlasEditor` seed → `mountAtlasPrototype3d({ controlled, seedState })`
2. Runtime `persist()` → `onPersist` → `updateWebglRuntime` + `syncWebglPropsIntoCanvasDoc` → dirty → debounced/`saveCanvas` → `mergeWebglRuntimeIntoGeneratorMeta` → upsert with `expectedRevision`

## Verdict
CLEAR

## Notes
- Product path does not write authoritative world state to `sagatree-atlas-webgl-v3`.
- Legacy localStorage is read-once seed only when meta runtime is absent.
- Migration 106 removes ambiguous 2-arg `get_world_atlas_map` overload.
- Browser proof: `.qa/evidence/atlas-worldbuilder-shared-editor/`

