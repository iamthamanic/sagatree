<!-- migration-contract:v2 localId=MIG-312 -->
# MIG-312: Port infrastructure/user-profile adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/user-profile: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/user-profile: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/media/index.ts, src/domains/media/optimization-contract.ts, src/domains/media/optimization-policy.ts, src/domains/user-profile/contracts/user-profile.types.ts, src/domains/user-profile/display-name.ts, src/domains/user-profile/index.ts, src/infrastructure/media/optimizer/engines/audio/index.ts, src/infrastructure/media/optimizer/engines/image/image.worker.ts, src/infrastructure/media/optimizer/engines/image/index.ts, src/infrastructure/media/optimizer/engines/image/optimize-image.ts, src/infrastructure/media/optimizer/engines/image/raster-decode.ts, src/infrastructure/media/optimizer/engines/image/resource-limits.ts, src/infrastructure/media/optimizer/engines/image/types.ts, src/infrastructure/media/optimizer/engines/image/webp-budget.ts, src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts, src/infrastructure/media/optimizer/engines/model3d/index.ts, src/infrastructure/media/optimizer/engines/video/index.ts, src/infrastructure/media/optimizer/index.ts, src/infrastructure/media/optimizer/media-optimizer.ts, src/infrastructure/user-profile/account-avatar-changed.ts, src/infrastructure/user-profile/account-avatar-store.ts, src/infrastructure/user-profile/supabase-user-profile.repository.ts, src/infrastructure/user-profile/user-profile-service.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-user-profile.md, .qa/intake/edge-infra-contracts/source-contracts/infra-user-profile.json.

### Nachher und Verhalten

src/infrastructure/user-profile: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/user-profile/contracts/user-profile.types.ts`, `src/domains/user-profile/display-name.ts`, `src/domains/user-profile/index.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/infrastructure/user-profile/account-avatar-changed.ts`, `src/infrastructure/user-profile/account-avatar-store.ts`, `src/infrastructure/user-profile/supabase-user-profile.repository.ts`, `src/infrastructure/user-profile/user-profile-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-user-profile.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-user-profile.json`

## Integration peers

- #805 (MIG-306)

Diese Adapter interagieren über die in MIG-012 fixierten Ports. Bestehende Signaturen bleiben beim einzelnen Port stabil; die gemeinsame Abnahme erfolgt in MIG-600. Ihre gegenseitigen Imports erzeugen kein zyklisches Startverbot.

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

### Bekannte Legacy-Defekte / offene Verifikation

- Object deletion is best effort/asynchronous and separate from profile row update; no atomic storage+DB transaction. There is no standalone delete-avatar or display-name mutation method in this facade.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für user-profile und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für user-profile ausführt
- Dann: Own row race23505 succeeds; actual select/insert errors fail with formatted details.
- Quelle: `.qa/intake/edge-infra-contracts/infra-user-profile.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-user-profile.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für user-profile und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für user-profile ausführt
- Dann: Batch IDs are trimmed/deduplicated, absent rows omitted, signing failures returnavatarUrl null, and visible teammate profiles remain displayable.
- Quelle: `.qa/intake/edge-infra-contracts/infra-user-profile.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-user-profile.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für user-profile und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für user-profile ausführt
- Dann: Valid<=5MiB avatar replaces own path and emits cache/event update; foreign writes denied; invalid magic/MIME/size rejected; DB update failure cleans new object while retaining previous row.
- Quelle: `.qa/intake/edge-infra-contracts/infra-user-profile.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-user-profile.json`

## Acceptance

- [ ] Own row race23505 succeeds; actual select/insert errors fail with formatted details.
- [ ] Batch IDs are trimmed/deduplicated, absent rows omitted, signing failures returnavatarUrl null, and visible teammate profiles remain displayable.
- [ ] Valid<=5MiB avatar replaces own path and emits cache/event update; foreign writes denied; invalid magic/MIME/size rejected; DB update failure cleans new object while retaining previous row.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #841 (MIG-500)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-312`
- Design: `.qa/design/migration-issues/stack-migration-mig-312.md`
- Status: blocked
- Reihenfolge: 78; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-078`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-312.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
