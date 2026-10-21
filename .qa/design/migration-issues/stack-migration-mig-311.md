<!-- migration-contract:v2 localId=MIG-311 -->
# MIG-311: Port infrastructure/session adapters from Supabase to host repositories

## Type

Task

## Intent

src/infrastructure/session: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/session: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/domains/resource-id/session-routing.ts, src/domains/session/contracts/live-session-access.ts, src/domains/session/contracts/session-invite.ts, src/domains/session/contracts/session-lifecycle.ts, src/domains/session/contracts/session-prepare-recap.ts, src/domains/session/contracts/session-runtime.ts, src/domains/session/contracts/session.types.ts, src/domains/session/media/media-plane-contract.ts, src/infrastructure/session/live-session-access.resolver.ts, src/infrastructure/session/media/index.ts, src/infrastructure/session/media/livekit-media-plane-adapter.ts, src/infrastructure/session/media/media-plane-adapter.ts, src/infrastructure/session/media/media-token-client.ts, src/infrastructure/session/media/memory-media-plane-adapter.ts, src/infrastructure/session/media/memory-media-plane-bus.ts, src/infrastructure/session/media/session-media-plane.ts, src/infrastructure/session/session-lobby-channel.ts, src/infrastructure/session/session-recap-ai-service.ts, src/infrastructure/session/session-recap-service.ts, src/infrastructure/session/session-runtime-channel.ts, src/infrastructure/session/session-runtime-service.ts, src/infrastructure/session/session-service.ts, src/lib/authenticatedUser.ts, src/lib/localAdmin.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/infra-session.md, .qa/intake/edge-infra-contracts/source-contracts/infra-session.json.

### Nachher und Verhalten

src/infrastructure/session: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Scope

- Quellpfade: `src/domains/resource-id/session-routing.ts`, `src/domains/session/contracts/live-session-access.ts`, `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-prepare-recap.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/domains/session/contracts/session.types.ts`, `src/domains/session/media/media-plane-contract.ts`, `src/infrastructure/session/live-session-access.resolver.ts`, `src/infrastructure/session/media/index.ts`, `src/infrastructure/session/media/livekit-media-plane-adapter.ts`, `src/infrastructure/session/media/media-plane-adapter.ts`, `src/infrastructure/session/media/media-token-client.ts`, `src/infrastructure/session/media/memory-media-plane-adapter.ts`, `src/infrastructure/session/media/memory-media-plane-bus.ts`, `src/infrastructure/session/media/session-media-plane.ts`, `src/infrastructure/session/session-lobby-channel.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

## Security & Data

Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.

### Bekannte Legacy-Defekte / offene Verifikation

- Lobby broadcasts accept caller userId without identity binding; ready must remain non-authoritative.
- Runtime has a snapshot/subscription gap and overlapping refreshes have no explicit revision ordering or catch; initial code does not guarantee automatic gap-free reconnect.
- LiveKit adapter requires injected roomFactory, reports only local participant presence and optional SDK methods can be absent; token issuance alone is not live media verification.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: All12 exact RPC variants and2 Edge invokes preserve argument/error/decoder contracts; wrong user/GM/foreign session cannot mutate runtime.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Runtime event subscriptions use exact table/event/session filters and removeChannel on unsubscribe; explicit resync reloads authoritative state. Snapshot-before-subscribe gap and overlapping fetch ordering require an explicit successor consistency fixture.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Lobby ready is ephemeral broadcast with exacttopic/event/payload; spoofed ready userId cannot authorize gameplay.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Media missing factory/token/server becomes degraded without blocking gameplay; viewer publication denied by media-plane access; local-only presence and reliable:false data behavior remain explicit.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

## Acceptance

- [ ] All12 exact RPC variants and2 Edge invokes preserve argument/error/decoder contracts; wrong user/GM/foreign session cannot mutate runtime.
- [ ] Runtime event subscriptions use exact table/event/session filters and removeChannel on unsubscribe; explicit resync reloads authoritative state. Snapshot-before-subscribe gap and overlapping fetch ordering require an explicit successor consistency fixture.
- [ ] Lobby ready is ephemeral broadcast with exacttopic/event/payload; spoofed ready userId cannot authorize gameplay.
- [ ] Media missing factory/token/server becomes degraded without blocking gameplay; viewer publication denied by media-plane access; local-only presence and reliable:false data behavior remain explicit.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #867 (RPC-SESSION-RUNTIME)
- Depends on #868 (RPC-SESSION-LIFECYCLE)
- Depends on #869 (RPC-SESSION-ACCESS)
- Depends on #870 (RPC-SESSION-RECAP)
- Depends on #836 (MIG-420)
- Depends on #837 (MIG-421)
- Depends on #796 (MIG-021)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-311`
- Design: `.qa/design/migration-issues/stack-migration-mig-311.md`
- Status: blocked
- Reihenfolge: 77; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-077`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-311.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
