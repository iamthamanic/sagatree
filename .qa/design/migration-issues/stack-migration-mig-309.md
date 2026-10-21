<!-- migration-contract:v2 localId=MIG-309 -->
# MIG-309: Port infrastructure/rulesets adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/rulesets: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/rulesets: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/rules/ruleset-catalog/index.ts, src/domains/rules/ruleset-catalog/types.ts, src/infrastructure/rulesets/ruleset-service.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-rulesets.md, .qa/intake/edge-infra-contracts/source-contracts/infra-rulesets.json.

### Nachher und Verhalten

src/infrastructure/rulesets: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/rules/ruleset-catalog/index.ts`, `src/domains/rules/ruleset-catalog/types.ts`, `src/infrastructure/rulesets/ruleset-service.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-rulesets.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für rulesets und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für rulesets ausführt
- Dann: Load default/native/custom ruleset with equivalent sorting and decoding.
- Quelle: `.qa/intake/edge-infra-contracts/infra-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-rulesets.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für rulesets und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für rulesets ausführt
- Dann: Owner can save permitted custom ruleset; foreign owner write denied and public ruleset read not accidentally restricted.
- Quelle: `.qa/intake/edge-infra-contracts/infra-rulesets.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-rulesets.json`

## Acceptance

- [ ] Load default/native/custom ruleset with equivalent sorting and decoding.
- [ ] Owner can save permitted custom ruleset; foreign owner write denied and public ruleset read not accidentally restricted.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-309`
- Design: `.qa/design/migration-issues/stack-migration-mig-309.md`
- Status: blocked
- Reihenfolge: 75; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-075`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-309.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
