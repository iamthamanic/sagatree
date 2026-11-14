# Feature: ATL2-E04 — LOD-Layer, Detailkarten-Lazy-Loading und Übergänge (#1222)

<!-- atlas-v2-epic: #1196; slice: E04; slug: atl2-e04 -->

## Intent

Sichtbare Inhalte folgen der Hierarchiestufe und dem Zoom zuverlässig — ohne
Pop-in, ohne doppelte Geo und ohne erfundene Detailkarten.

## Preconditions

- #1221 ATL2-E03 MERGED (hierarchy zoom / breadcrumb / back)
- #1216 ATL2-D05 MERGED (terrain mesh LOD strides)
- Domain SoT: primary maps (E01) + anchors (E02) + nav (E03)

## Happy Path

- [ ] Drill lädt den Kind-Datensatz (eigene primary map), nicht nur Elternkarte größer
- [ ] Semantic LOD-Band filtert Features unabhängig von Editor-Layer-Toggles
- [ ] Prefetch nur für verortete Kinder; Cache-Hit überspringt unnötigen Intent
- [ ] Schneller Wechsel cancelt stale loads (Generation-Token)
- [ ] Fade/Transition: child opacity 0→1, parent 1→0; Ready = child 1
- [ ] Speichern invalidiert Soft-Cache (`cacheEpoch` + entry drop)
- [ ] Fehlendes Kind / Load-Fehler: erklärbarer Zustand, Elternkarte navigierbar
- [ ] Touched files: zero type escape hatches
- [ ] **IV-01/02/09**: LOD visualisiert gespeicherte Anker; unlocated bleibt ehrlich
- [ ] **AU-CONTENT-WIDTH**: Transition/Error status readable in narrow main pane

## Edge Cases

- [ ] Unlocated child: kein Prefetch / kein scale-true Drill
- [ ] Abgebrochener Wechsel: cancelled phase, letzte ready Map bleibt aktiv
- [ ] Offline / Host-Fehler: `LOD_LOAD_FAILED_DE`, fallback activeMapId
- [ ] Building/room tip: parent settlement/region overlays suppressed

## Security Coverage

- No new write surface — map GET stays owner-scoped via host
- Cache is session-local soft memo; never elevates reads
- SC-01/02/03/06: N/A for client LOD session; launch SC N/A

## Composition Gate

CLEAR — enter-child begins load generation; editor applies semantic LOD flags;
failed load keeps prior activeMapId navigable
(see `.qa/runs/composition-gate-atl2-e04.md`)

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-hierarchy-lod.ts`
- App: `useWorldAtlasEditor` generation loads + cache; `UnifiedAtlasEditor`
  `hierarchyLodBand`; `WorldAtlasWorkbench` band + transition status
- Self-test: `scripts/atl2-e04-hierarchy-lod.self-test.mjs`
