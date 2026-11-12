# ATL2-B04 — WebGL geometry write-retire inventory

**Issue:** #1204 · **Slug:** `atl2-b04`

## Authority

| Surface | Role after B04 |
|---|---|
| `generator_meta.unifiedCanvas` | **Sole persisted geometry SoT** |
| `generator_meta.atlasMapDocV2` | Classification sidecar (B02); not a second geometry store |
| `generator_meta.webglRuntimeV3` | Legacy **read** + ephemeral 3D seed; geometry cleared on product persist |
| `generator_meta.webglRuntimeV3GeometryBackup` | One-shot rollback of stripped geometry |
| `localStorage` `sagatree-atlas-webgl-v3` | Import-only (never product SoT) |
| In-memory `syncCanvasDocIntoWebglRuntime` | Ephemeral 3D mount seed — not a host write |

## Removed / retired (write path)

| Path | Disposition |
|---|---|
| `useWorldAtlasEditor.saveCanvas` dual-merge of full `webglRuntime` geometry | **Retired** → `mergeCanonicalAtlasGeometryForPersist` |
| Persisted props/walls/strokes/rooms under `webglRuntimeV3` after save | **Stripped** (layers/extras kept) |

## Kept (read / ephemeral)

| Path | Why |
|---|---|
| `extractWebglRuntimeFromGeneratorMeta` | Legacy load |
| `hydrateCanvasFromLegacyWebgl` | One-shot import when canvas empty |
| `syncWebglPropsIntoCanvasDoc` / `syncCanvasDocIntoWebglRuntime` | 3D↔2D projection (#749) |
| `AtlasNative3dEditor` controlled seed | Remount from canonical doc |
| Renderer choice / duplicate WebGL engines | Deferred to D-gate (non-goal) |

## Ghost regression contract

1. Canonical canvas without entity X + stale sidecar still containing X → after persist, sidecar empty; reload keeps X deleted.
2. Delete last object → canvas `objects: []` and sidecar geometry empty after save.
3. Legacy-only sidecar → hydrate imports into canvas; first save strips sidecar + backup.

## Non-goals

- Deleting `webgl-runtime-bridge.ts` or the 3D prototype runtime.
- Choosing Three.js vs custom WebGL as product renderer (D-gate).
