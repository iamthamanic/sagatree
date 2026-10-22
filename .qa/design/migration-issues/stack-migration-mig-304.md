<!-- migration-contract:v2 localId=MIG-304 -->
# MIG-304: Port infrastructure/look adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/look: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/look: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/character/avatar/mtoon-profile.ts, src/domains/look/advanced-adaption.ts, src/domains/look/advanced-look-capability-status.ts, src/domains/look/advanced-look-provider-registry.ts, src/domains/look/capability-metadata.ts, src/domains/look/index.ts, src/domains/look/invariants.ts, src/domains/look/library-query.ts, src/domains/look/parse.ts, src/domains/look/persistence-contracts.ts, src/domains/look/personal-look-override.ts, src/domains/look/reference-analysis.ts, src/domains/look/resolve.ts, src/domains/look/system-default.ts, src/domains/look/types.ts, src/domains/look/write-draft.ts, src/infrastructure/character/avatar/mtoon-style-applier.ts, src/infrastructure/character/avatar/toonlab-compatibility-spike.ts, src/infrastructure/look/adapters/host-mtoon-look-adapter.ts, src/infrastructure/look/adapters/toonlab-look-adapter.ts, src/infrastructure/look/index.ts, src/infrastructure/look/look-material-roles.ts, src/infrastructure/look/look-reference-analysis-service.ts, src/infrastructure/look/look-runtime-types.ts, src/infrastructure/look/look-runtime.ts, src/infrastructure/look/look-service.ts, src/infrastructure/look/look.persistence.ts, src/infrastructure/look/supabase-look.repository.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-look.md, .qa/intake/edge-infra-contracts/source-contracts/infra-look.json.

### Nachher und Verhalten

src/infrastructure/look: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/character/avatar/mtoon-profile.ts`, `src/domains/look/advanced-adaption.ts`, `src/domains/look/advanced-look-capability-status.ts`, `src/domains/look/advanced-look-provider-registry.ts`, `src/domains/look/capability-metadata.ts`, `src/domains/look/index.ts`, `src/domains/look/invariants.ts`, `src/domains/look/library-query.ts`, `src/domains/look/parse.ts`, `src/domains/look/persistence-contracts.ts`, `src/domains/look/personal-look-override.ts`, `src/domains/look/reference-analysis.ts`, `src/domains/look/resolve.ts`, `src/domains/look/system-default.ts`, `src/domains/look/types.ts`, `src/domains/look/write-draft.ts`, `src/infrastructure/character/avatar/mtoon-style-applier.ts`, `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts`, `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts`, `src/infrastructure/look/adapters/toonlab-look-adapter.ts`, `src/infrastructure/look/index.ts`, `src/infrastructure/look/look-material-roles.ts`, `src/infrastructure/look/look-reference-analysis-service.ts`, `src/infrastructure/look/look-runtime-types.ts`, `src/infrastructure/look/look-runtime.ts`, `src/infrastructure/look/look-service.ts`, `src/infrastructure/look/look.persistence.ts`, `src/infrastructure/look/supabase-look.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

## Integration peers

- #801 (MIG-302)

Diese Adapter interagieren über die in MIG-012 fixierten Ports. Bestehende Signaturen bleiben beim einzelnen Port stabil; die gemeinsame Abnahme erfolgt in MIG-600. Ihre gegenseitigen Imports erzeugen kein zyklisches Startverbot.

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Local look runtime adapters remain unchanged by persistence transport replacement.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

## Acceptance

- [ ] Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- [ ] Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- [ ] Local look runtime adapters remain unchanged by persistence transport replacement.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #828 (MIG-412)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-304`
- Design: `.qa/design/migration-issues/stack-migration-mig-304.md`
- Status: blocked
- Reihenfolge: 70; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-070`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-304.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
