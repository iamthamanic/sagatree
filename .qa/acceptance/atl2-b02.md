# Feature: ATL2-B02 — Lossless V1/Legacy→V2 map adapter (#1202)

<!-- atlas-v2-epic: #1196; slice: B02; slug: atl2-b02 -->

## Intent

Bereits gespeicherte Donalu-/Golden-Karten lassen sich rückwärtskompatibel ohne
ID- und Geometrieverlust in das Zielmodell (B01-Katalog + V1-Wire) übernehmen.

## Preconditions

- #1201 merged (canonical feature catalog).
- Wire format remains `sagatree-unified-atlas-v1`.

## Happy Path

- [ ] V1→V2 view→V1 wire roundtrip preserves IDs, geometry, layers, secrets, anchors
- [ ] Ambiguous strokes/rooms marked `legacy_*_ambiguous`, not guessed
- [ ] Backup snapshot before adapter write; restore helper tested
- [ ] Interrupted / rejected parse leaves prior revision intact (no partial clobber)

## Edge Cases

- [ ] Empty / missing unifiedCanvas
- [ ] Golden Dornhain v4 full doc
- [ ] WebGL runtime sidecar present (not SoT; not deleted)
- [ ] Unknown format → reject

## Security Coverage

- Adapter is pure domain; host authz unchanged
- `secret` flags preserved on roundtrip
- Out of scope: new HTTP routes (B03)

## Composition Gate

SKIPPED — domain adapter + tests; no new hop
(see `.qa/runs/composition-gate-atl2-b02.md`)

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-map-doc-adapter.ts`
- Self-test: `scripts/atl2-b02-map-doc-adapter.self-test.mjs`
