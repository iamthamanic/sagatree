# Feature: CUT-02: Restore NPC and creature controller assignment via host product routes

<!-- seeded by ecc-runner from issue #1137 on 2026-11-05 — refined after coding -->

## Intent
Bereits vorhandene NPC-Controller-Zuweisung vom Postgres-RPC `assign_npc_creature_controller` auf die Host-Port-Implementierung umstellen.

## Happy Path
- [x] Bestehende UI-Aktion erreicht einen getypten Host-HTTP/Use-Case/Owner-Port-Pfad; keine Supabase-Fallback- oder soft-DENY-Antwort unter host-first.
- [x] Fachliche Ergebnis-, Fehler- und Persistenzparität gegenüber alter Implementierung mit echten Host-SQLite-Fixtures (`scripts/cut-02-npc-controller.self-test.mjs`).
- [x] Reale Negativtests für unauthorized / non-GM / non-member controller; Inventory-Check + CUT-02 self-test grün.
- [x] UI/UX bleibt unverändert: Existing NPC promotion/controller screen, unchanged labels and interaction; precise pending/success/error feedback.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases
- [x] Nullable `controllerUserId` clears assignment (idempotent)
- [x] Duplicate assign retry idempotent
- [x] Non-member controller rejected server-side (client `activeMemberUserIds` is hint only)

## Regression
- [x] Existing NPC library CRUD host routes still load (`fe-host-05`)
- [x] Cutover inventory matrix stays consistent (HOST_VERIFIED flip for #1137 rows)

## Assumptions
- none

## Screenshots
| Step | Filename |
|------|----------|
| 1 | `01-happy-path.png` |

## Implementation Notes
- Routes: `GET|POST /api/v1/library/npc-creatures/:id/controller` (GET query `projectId`; POST body `{ projectId, controllerUserId }`)
- Ports: `NpcCreaturePorts.getControllerAssignment` + existing `assignController`
- FE dual-path: `host-library-http` + `npc-creature-service` under `isHostLibraryEnabled()`
