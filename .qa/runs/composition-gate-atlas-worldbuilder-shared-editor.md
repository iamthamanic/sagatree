# Composition Gate — atlas-worldbuilder-shared-editor

## Feature slug
`atlas-worldbuilder-shared-editor` (#721)

## HEAD
`4ae66b1fc5fc5c58940e3d347760c17aeb7f9e29` (pre-commit worktree; update on commit)
See git HEAD at merge time.

## Producer → consumer

1. `generator_meta.webglRuntimeV3` (DB map upsert) → `useWorldAtlasEditor` extract → `UnifiedAtlasEditor` seed → `mountAtlasPrototype3d({ controlled, seedState })`
2. Runtime `persist()` → `onPersist` → `updateWebglRuntime` + `syncWebglPropsIntoCanvasDoc` → dirty → debounced/`saveCanvas` → `mergeWebglRuntimeIntoGeneratorMeta` → upsert with `expectedRevision`

## Verdict
CLEAR

## Notes
- Product path does not write authoritative world state to `sagatree-atlas-webgl-v3`.
- Legacy localStorage is read-once seed only when meta runtime is absent.
- N-actors: same map revision CAS; conflict surfaces as save error (no silent overwrite).
