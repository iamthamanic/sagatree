# Acceptance — RPC-NPC-INSTANCES (#877)

## Intent
Port spawn/assign/update/remove/clear NPC creature instance RPCs with narrow GM scope.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847.

## Required Tests
- [x] Instanzerzeugung/Entfernung verlangen GM-Scope und Projekt-/Session-Zugehörigkeit.
- [x] personal:/world: Definition muss existieren und für den Actor lesbar sein; core:/builtin ohne DB-Zeile.
- [x] Runtime-Updates sind GM-exklusiv; Snapshot unverändert; Controller ohne Schreibrecht.
- [x] temporaryControllerUserId bei Spawn und Runtime-Update nur aktives Projektmitglied.
- [x] Controller-Zuordnung verlangt aktives Mitglied; Definition active+full sheet.
- [x] Session-Cleanup entfernt nur temporäre Controller dieser Session (exakte Anzahl).
- [x] Touched files: zero type escape hatches.
- [x] scripts/rpc-npc-instances.self-test.mjs → PASS

## Evidence
`scripts/rpc-npc-instances.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-npc-instances.md`.
