# Feature: ATL2-F05 — [GATE F] Dungeon generate / edit / 2D–3D parity (#1228)

<!-- atlas-v2-epic: #1196; slice: F05; slug: atl2-f05 -->

## Intent

Ein vollständiger Goldendungeon bleibt vom Seed bis zum Reload korrekt und mit
WorldNode verknüpft — produktive Forge-Pipeline (F01–F04), keine reine Demo.

## Preconditions

- #1224 F01, #1225 F02, #1226 F03, #1227 F04 merged
- Productive 3D target remains `custom-webgl-prototype-runtime` (R01 NO-GO)

## Happy Path

- [x] generate → preview → commit → edit → reopen → 3D look → reload → reforge guard
- [x] BFS passability bleibt nach Rasterize/Commit grün
- [x] Theme-Switch ändert Look, nicht Feature-IDs / geometryFingerprint
- [x] Nach manueller Änderung + Meta-Reload bleiben IDs/Geometrie erhalten
- [x] Touched files: zero type escape hatches (Boy Scout on gate evidence)

## Edge Cases

- [x] Dirty / confirmed reforge verlangt Confirm (`dungeonNeedsReforgeConfirm`)
- [x] Corrupt / invalid generate → kein Commit-Payload
- [x] Unauthorized (`canEdit=false`) → Forge-UI ausgeblendet (GM-only)
- [x] Player view: Forge gated; GM-vs-Player notes dokumentiert

## Security Coverage

- Generate/Commit nur für autorisierten GM (`canEdit`); Generator-Version/Seed sind Metadaten
- Benutzeränderungen bleiben kanonischer Inhalt (strip nur `droom-/dwall-/…`)
- SC-01/02: no new auth routes; persist via existing world-atlas path

## Imagination-First (IV)

- [x] **IV-01** Meshes/Look visualisieren nur gespeicherte Rooms/Walls/Doors/Props
- [x] **IV-02** Theme/Licht = atmospheric; IDs canonical
- [x] **IV-18** `generator_meta.dungeon` seed/version/themeKey; `manualDirty` on edits

## Adaptive UI (AU)

- Gate evidence only — forge panel remains canEdit-gated Journey control (AU-N/A for new chrome)

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-f05.md`

## GM vs Player

| Role | Forge generate/commit | Manual edit | 3D look |
|------|----------------------|-------------|---------|
| GM (`canEdit=true`) | Yes | Yes; sets `manualDirty` | Theme from meta / preview |
| Player (`canEdit=false` / playerView) | Hidden (`data-atlas-dungeon-forge` not rendered) | Read-only canvas | View-only; no reforge |

## Implementation Notes

- Evidence lock over F01–F04 domains + UnifiedAtlasEditor gates
- Self-test: `scripts/atl2-f05-gate-f.self-test.mjs`
- Non-goals: isolated generator-only green ≠ Gate F; no Three.js product path (#1267–#1270)
