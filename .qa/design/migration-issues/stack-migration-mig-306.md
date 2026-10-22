<!-- migration-contract:v2 localId=MIG-306 -->
# MIG-306: Port infrastructure/media adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/media: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/media: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/media/index.ts, src/domains/media/optimization-contract.ts, src/domains/media/optimization-policy.ts, src/infrastructure/media/optimizer/engines/audio/index.ts, src/infrastructure/media/optimizer/engines/image/image.worker.ts, src/infrastructure/media/optimizer/engines/image/index.ts, src/infrastructure/media/optimizer/engines/image/optimize-image.ts, src/infrastructure/media/optimizer/engines/image/raster-decode.ts, src/infrastructure/media/optimizer/engines/image/resource-limits.ts, src/infrastructure/media/optimizer/engines/image/types.ts, src/infrastructure/media/optimizer/engines/image/webp-budget.ts, src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts, src/infrastructure/media/optimizer/engines/model3d/index.ts, src/infrastructure/media/optimizer/engines/video/index.ts, src/infrastructure/media/optimizer/index.ts, src/infrastructure/media/optimizer/media-optimizer.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-media.md, .qa/intake/edge-infra-contracts/source-contracts/infra-media.json.

### Nachher und Verhalten

src/infrastructure/media: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-media.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für media und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für media ausführt
- Dann: Optimize image to target WebP budget with valid dimensions; cancel/reject oversized/unsupported input deterministically.
- Quelle: `.qa/intake/edge-infra-contracts/infra-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-media.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für media und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für media ausführt
- Dann: Audio/video/model3d capability/degraded contracts remain explicit; no new remote service required for current local optimizer.
- Quelle: `.qa/intake/edge-infra-contracts/infra-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-media.json`

## Acceptance

- [ ] Optimize image to target WebP budget with valid dimensions; cancel/reject oversized/unsupported input deterministically.
- [ ] Audio/video/model3d capability/degraded contracts remain explicit; no new remote service required for current local optimizer.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-306`
- Design: `.qa/design/migration-issues/stack-migration-mig-306.md`
- Status: blocked
- Reihenfolge: 72; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-072`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-306.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
