# Feature: ATL2-G01 — GM / Player / Owner atlas scopes & secrets (#1229)

<!-- atlas-v2-epic: #1196; slice: G01; slug: atl2-g01 -->

## Intent

Spieler sehen nie GM-only-Welt-, Dungeon- oder Session-Geheimnisse — auch nicht
über direkt aufrufbare Host-APIs (keine bloß clientseitige CSS-Ausblendung).

## Preconditions

- #1223 Gate E + #1228 Gate F MERGED
- Better Auth + Policy Service owner/member paths
- Host world atlas list/get/upsert with `playerView`

## Happy Path

- [x] Owner/GM liest volle Karten inkl. Secrets und Azgaar-Pfade
- [x] Player (`playerView` oder non-editor) erhält nur party-revealed Maps
- [x] Party-Payload: secret features/entities + editorSecret entfernt
- [x] Party-Dungeon-Meta: nur atmospheric `themeKey` (kein Seed / Dirty)
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Fremde Welt / Cross-Saga-Reveal → `42501` / existence-hiding `P0002`
- [x] Player-Upsert / Ensure-Root → `42501`
- [x] Secret doors in `unifiedCanvas` stripped for party
- [x] Undiscovered / secret GeoJSON features filtered

## Security Coverage

- SC-01 Owner-scoped writes (`canEditWorld` / owner_user_id)
- SC-02 Party projection server-side (`WorldAtlasStore` / places bindings)
- SC-03 No elevated origins inventable from client `playerView=false` when non-editor
- Imagination-First **IV-01/02**: secrets not reconstructed from atmospheric theme

## Adaptive UI (AU)

- N/A for new chrome — scope is host policy + projection

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g01.md`

## Implementation Notes

- Domain SoT: `src/domains/world/atlas/party-map-projection.ts`
- Host wire: `server/.../party-map-projection.ts` + `WorldAtlasStore` party path
- Evidence: `scripts/atl2-g01-scopes.self-test.mjs` (+ existing player-projection / rpc-atlas-maps)
- Non-goals: CSS-only hide; Three.js product path (#1267–#1270 / R02–R05)
