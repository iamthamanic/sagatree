# Feature: ATL2-C05 — Atlas Workstation adaptive / a11y (#1210)

<!-- atlas-v2-epic: #1196; slice: C05; slug: atl2-c05 -->

## Intent

Bestehendes Atlas-Editor-Layout bleibt auf schmalem Hauptbereich bedienbar
(Desktop/Tablet/Telefon + Split-Pane), ohne parallelen Editor.

## Surface class

**Workstation** (AU contract §2 / §6.2). Phone = reduced composition (map +
sheets/tool rail); full multi-pane Desktop when content width ≥768px.

## AU gates

- **AU-CONTENT-WIDTH** — `@container/main` workbench + composition from content band
- Touch targets ≥44px (existing `min-h-11` / tool rail)
- Safe-area insets on workbench header / editor bottom
- Persist/conflict status remains visible (C04)

## Preconditions

- #1209 ATL2-C04 CLEAR.

## Happy Path

- [ ] Desktop content ≥768px: side rails; Phone/narrow: sheets + floating tool rail
- [ ] `data-atlas-content-band` / `data-atlas-reduced-phone` reflect composition
- [ ] Undo/Redo announce via `aria-live` (`data-atlas-history-live`)
- [ ] Touch interaction hint visible under 48rem container
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Content width 320px still usable (no required page scroll for primary map)
- [ ] Conflict banner + Speichern remain reachable on Phone

## Security Coverage

- Writes remain host/policy bound; adaptive chrome does not elevate auth

## Composition Gate

SKIPPED — adaptive chrome on existing upsert hop

## Implementation Notes

- Domain: `atlas-workstation-adaptive.ts`
- Workbench: `useAdaptiveContentBand` + safe-area
- Editor: `@container/atlas`, history live region, touch hint
- Self-test: `scripts/atl2-c05-adaptive-workstation.self-test.mjs`
