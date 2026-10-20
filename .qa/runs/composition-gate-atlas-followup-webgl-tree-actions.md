# Composition Gate — atlas-followup-webgl-tree-actions (#748)

- HEAD_SHA: 48938a085329f4d6bc113d7c218ae7c377ab3b06
- BASE_SHA: 9e4582099e228965a0c8b40b54c41a00c6fc123b
- Date: 2026-10-19
- Verdict: CLEAR

## Event

GM uses default product WebGL #nav + / rename / duplicate / reparent / archive; React host opens CreateWorldNodeDialog or consequence dialogs; mutations commit only via authenticated RPCs; tree reloads from DB after success.

## Hop chain

1. Producer: WebGL `#nav` click (`data-nav-add` / dup / reparent / del) → runtime callbacks
2. Bridge: `AtlasNative3dEditor` → `UnifiedAtlasEditor` → `WorldAtlasWorkbench`
3. Consumer A: `CreateWorldNodeDialog` / `WebglNavTreeActionHost` → `worldPlaceService.createNodeWithMaps` / mutation RPCs
4. Consumer B: `reloadPlaceNav` + `editor.setActiveMapId(targetMapId)` after verified response
5. Gate: RLS/RPC authz; no localStorage product tree SoT; no success without RPC completion

## Simulations

- N-actors: world_profile_id scoped RPCs; concurrent GMs cannot mutate foreign worlds.
- Invalid/missing: cancel/dialog close creates zero rows; wrong parent / unauthorized actor rejected by RPC.
- Two consumers / crash: retry uses idempotency key on create; archive/reparent require confirm flags; tree refresh after success only.

## Flags

(none)
