# Feature: ATL2-B03 — Atomic owner-scoped Atlas revisions (#1203)

<!-- atlas-v2-epic: #1196; slice: B03; slug: atl2-b03 -->

## Intent

Bearbeitung mehrerer Features und Karten darf keine unautorisierten oder
teilweise geschriebenen Zustände erzeugen (CAS + Owner-Policy).

## Preconditions

- #1202 merged.
- Host `world_atlas_maps.revision` + Policy Service ownership.

## Happy Path

- [ ] Update ohne `expectedRevision` wird abgelehnt (22023)
- [ ] Stale revision → 40001 Konflikt (kein stilles Überschreiben)
- [ ] Fremder Actor → 42501 auf Write
- [ ] Gebündeltes Changeset (mehrere MapEditOps) atomar auf Canvas anwendbar
- [ ] Autosave-Kontrakt dokumentiert (debounce, never fake-saved)

## Edge Cases

- [ ] Zwei Tabs: zweiter Save mit alter Revision → Konflikt
- [ ] Unterbrochener Write: BEGIN IMMEDIATE + ROLLBACK lässt Prior-Revision
- [ ] Create (mapId null) bleibt ohne expectedRevision erlaubt

## Security Coverage

- canEditWorld / owner identity ids on upsert
- Player/non-owner cannot write
- Out of scope: CRDT / realtime collab

## Composition Gate

SKIPPED — host CAS hardening + domain autosave contract; hop already exists
(see `.qa/runs/composition-gate-atl2-b03.md`)

## Implementation Notes

- Host: `server/src/modules/world/internal/world-atlas-store.ts`
- Domain: `src/domains/world/atlas/atlas-revision-contract.ts`
- Self-test: `scripts/atl2-b03-atomic-revisions.self-test.mjs`
