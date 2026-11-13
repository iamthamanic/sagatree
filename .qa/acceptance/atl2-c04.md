# Feature: ATL2-C04 — Undo/Redo, edit batches, autosave, reload (#1209)

<!-- atlas-v2-epic: #1196; slice: C04; slug: atl2-c04 -->

## Intent

Manuelle Bearbeitung kann gefahrlos rückgängig gemacht und bei Reload
wiederhergestellt werden; Autosave und Konflikte sind revisionssicher.

## Preconditions

- #1208 ATL2-C03 CLEAR.

## Happy Path

- [ ] ≥100 Edit-/Undo-/Redo-Zyklen erhalten korrekte Geometrie
- [ ] Drag/Paint-Gesten bilden eine Undo-Einheit (Batch)
- [ ] Autosave nutzt `decideAtlasAutosave` + CAS `expectedRevision`
- [ ] Save-Fehler (Konflikt) setzen `conflict`, nie stilles „Gespeichert“
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Konflikt blockiert Autosave bis Reload/Retry
- [ ] Leere History: Undo/Redo disabled
- [ ] Batch-Cancel stellt batchBase wieder her

## Security Coverage

- Host upsert bleibt owner/revision-gebunden; UI ist keine Autorität

## Composition Gate

SKIPPED — editor history/autosave chrome on existing upsert hop

## Implementation Notes

- Domain: `atlas-edit-history.ts`; reuse `atlas-persist-state` / `atlas-revision-contract`
- Editor: UnifiedAtlasEditor history + gesture batches
- Hook/Workbench: pendingOps + decideAtlasAutosave
- Self-test: `scripts/atl2-c04-undo-autosave.self-test.mjs`
