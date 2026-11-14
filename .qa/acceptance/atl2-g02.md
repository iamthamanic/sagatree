# Feature: ATL2-G02 — Atlas rendering / memory / load / zoom budgets (#1230)

<!-- atlas-v2-epic: #1196; slice: G02; slug: atl2-g02 -->

## Intent

Große Karten und Dungeons laufen mit messbaren Budgets (Frame-P95, Cold-Load,
Draw Calls, Heap-Delta) und ohne unbounded Ressourcenwachstum bei Kartenwechseln
oder WebGL-Context-Loss — ohne willkürliche 60-FPS-Garantie.

## Preconditions

- #1218 Gate D, #1223 Gate E, #1228 Gate F MERGED
- Graphics presets (`high` / `balanced` / `lite`) from ATL2-D01
- Product 3D = custom WebGL prototype runtime (R01 NO-GO for Three follow-ons)

## Happy Path

- [x] Referenzhardware + Scene-Fixtures (small/medium/large) dokumentiert
- [x] Budgets für Frame-P95, Cold-Load, Draw Calls, Heap-Delta, retained handles
- [x] Large Stadt/Dungeon-Zelle (`large` × `lite`) erfüllt Draw-Call-Budget (CI)
- [x] Map-Switch-Stress: live handles reclaim nach jedem Dispose
- [x] Context-Loss Simulation: live handles → 0; Remount bleibt bounded
- [x] Degrade-Leiter high → balanced → lite bei Budget-Verletzung
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Lite-Preset bleibt lite (kein weiterer Degrade)
- [x] Peak live handles = per-map allocation (nicht N×)
- [x] Fehlbeobachtung → `evaluateAtlasPerfBudget.ok === false` + Violations

## Security Coverage

- SC-01 Budgets sind Domain-SoT — keine Secrets in Client-Perf-Caches
- SC-02 Keine Host-Policy-Änderung in diesem Slice

## Adaptive UI (AU)

- AU: Lite-Preset bevorzugt Software-Fallback (`preferSoftwareFallback`)
- CE: Budgets sind messbar; subjektive „smooth“-Ziele verboten

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g02.md`

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-perf-budgets.ts`
- Evidence: `scripts/atl2-g02-perf-budgets.self-test.mjs`
- Design: `.qa/design/atl2-g02-perf-budgets.md`
- Non-goals: guaranteed 60 FPS; Three.js product path (R02–R05)
