# Composition Gate — atlas-followup-editor-durability (#751)

- HEAD_SHA: a8b67a8b882a94b59d51d8e974c49c9de89f1fc0
- BASE_SHA: 8a341d5c98045e878e2bac5fa2ec3465708c55c5
- Date: 2026-10-19
- Verdict: CLEAR

## Event

GM edits atlas map (2D or product 3D); dirty → autosave/explicit save with expectedRevision; concurrent editor triggers conflict; Reload restores server map; Retry re-saves after confirm.

## Hop chain

1. Producer: UnifiedAtlasEditor / WebGL persist → `updateCanvasDoc` / `updateWebglRuntime`
2. Domain: `reduceAtlasPersistStatus` + `isAtlasRevisionConflictMessage`
3. Infra: `worldAtlasService.upsertMap` (`p_expected_revision`, ERRCODE 40001)
4. Consumer A: Workbench status chrome + conflict banner (Neu laden / Erneut speichern)
5. Consumer B: `reloadActiveMap` / map-switch confirm / `beforeunload` when dirty

## Simulations

- N-actors: two GMs same map → second save fails closed with conflict status (no silent LWW).
- Invalid/missing: network save_fail keeps dirty; never shows Gespeichert without save_ok.
- Two consumers / crash: saveInFlightRef serializes writes; aborted navigation confirm keeps draft.

## Flags

(none)
