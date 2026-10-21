<!-- migration-contract:v2 localId=MIG-305 -->
# MIG-305: Port infrastructure/marketplace adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/marketplace: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/marketplace: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/marketplace/contracts/marketplace.types.ts, src/infrastructure/marketplace/marketplace-service.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-marketplace.md, .qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json.

### Nachher und Verhalten

src/infrastructure/marketplace: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/marketplace/contracts/marketplace.types.ts`, `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

### Bekannte Legacy-Defekte / offene Verifikation

- incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
- Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: RPC increment succeeds atomically when installed; unavailable/denied RPC exercises read+update fallback and explicitly reports race, RLS and swallowed-error behavior.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Create cannot use a client author_id; update/delete foreign-author attempts are denied by effective server policy; delete returnsfalse on its documented failures.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Contract fixture for increment_marketplace_downloads: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

## Acceptance

- [ ] List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
- [ ] RPC increment succeeds atomically when installed; unavailable/denied RPC exercises read+update fallback and explicitly reports race, RLS and swallowed-error behavior.
- [ ] Create cannot use a client author_id; update/delete foreign-author attempts are denied by effective server policy; delete returnsfalse on its documented failures.
- [ ] Contract fixture for increment_marketplace_downloads: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #878 (RPC-MARKETPLACE-COUNT)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-305`
- Design: `.qa/design/migration-issues/stack-migration-mig-305.md`
- Status: blocked
- Reihenfolge: 71; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-071`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-305.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
