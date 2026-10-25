<!-- migration-contract:v2 localId=MIG-311 -->
# MIG-311: Port infrastructure/session adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/session: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/session: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/resource-id/session-routing.ts`, `src/domains/session/contracts/live-session-access.ts`, `src/domains/session/contracts/session-invite.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-prepare-recap.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/domains/session/contracts/session.types.ts`, `src/domains/session/media/media-plane-contract.ts`, `src/infrastructure/session/live-session-access.resolver.ts`, `src/infrastructure/session/media/index.ts`, `src/infrastructure/session/media/livekit-media-plane-adapter.ts`, `src/infrastructure/session/media/media-plane-adapter.ts`, `src/infrastructure/session/media/media-token-client.ts`, `src/infrastructure/session/media/memory-media-plane-adapter.ts`, `src/infrastructure/session/media/memory-media-plane-bus.ts`, `src/infrastructure/session/media/session-media-plane.ts`, `src/infrastructure/session/session-lobby-channel.ts`, `src/infrastructure/session/session-recap-ai-service.ts`, `src/infrastructure/session/session-recap-service.ts`, `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/session/session-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:


Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- (Acceptance/Regression, sperrt READY nicht) Lobby broadcasts accept caller userId without identity binding; ready must remain non-authoritative.
- (Acceptance/Regression, sperrt READY nicht) Runtime has a snapshot/subscription gap and overlapping refreshes have no explicit revision ordering or catch; initial code does not guarantee automatic gap-free reconnect.
- (Acceptance/Regression, sperrt READY nicht) LiveKit adapter requires injected roomFactory, reports only local participant presence and optional SDK methods can be absent; token issuance alone is not live media verification.

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

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for apply_session_runtime_command: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for create_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for create_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 8

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for get_session_recap: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 9

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for get_session_runtime_snapshot: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 10

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for join_session_by_code: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 11

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for leave_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 12

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for resolve_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 13

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for revoke_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 14

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for save_session_recap_summary: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 15

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for set_session_player_presence: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 16

- Gegeben: Der eingefrorene Quellvertrag für session und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session ausführt
- Dann: Contract fixture for set_session_status: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 17

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Lobby broadcasts accept caller userId without identity binding; ready must remain non-authoritative.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 18

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Runtime has a snapshot/subscription gap and overlapping refreshes have no explicit revision ordering or catch; initial code does not guarantee automatic gap-free reconnect.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

### Fall 19

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: LiveKit adapter requires injected roomFactory, reports only local participant presence and optional SDK methods can be absent; token issuance alone is not live media verification.
- Quelle: `.qa/intake/edge-infra-contracts/infra-session.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-session.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. All12 exact RPC variants and2 Edge invokes preserve argument/error/decoder contracts; wrong user/GM/foreign session cannot mutate runtime.
2. Runtime event subscriptions use exact table/event/session filters and removeChannel on unsubscribe; explicit resync reloads authoritative state. Snapshot-before-subscribe gap and overlapping fetch ordering require an explicit successor consistency fixture.
3. Lobby ready is ephemeral broadcast with exacttopic/event/payload; spoofed ready userId cannot authorize gameplay.
4. Media missing factory/token/server becomes degraded without blocking gameplay; viewer publication denied by media-plane access; local-only presence and reliable:false data behavior remain explicit.
5. Contract fixture for apply_session_runtime_command: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
6. Contract fixture for create_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
7. Contract fixture for create_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
8. Contract fixture for get_session_recap: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
9. Contract fixture for get_session_runtime_snapshot: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
10. Contract fixture for join_session_by_code: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
11. Contract fixture for leave_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
12. Contract fixture for resolve_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
13. Contract fixture for revoke_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
14. Contract fixture for save_session_recap_summary: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
15. Contract fixture for set_session_player_presence: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
16. Contract fixture for set_session_status: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
17. Verpflichtende Legacy-Regression: Lobby broadcasts accept caller userId without identity binding; ready must remain non-authoritative.
18. Verpflichtende Legacy-Regression: Runtime has a snapshot/subscription gap and overlapping refreshes have no explicit revision ordering or catch; initial code does not guarantee automatic gap-free reconnect.
19. Verpflichtende Legacy-Regression: LiveKit adapter requires injected roomFactory, reports only local participant presence and optional SDK methods can be absent; token issuance alone is not live media verification.
20. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 19 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Legacy frontend session adapter ports against host contracts. |
| **Acceptance tier** | `adapter-integration` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none for adapter wiring; feature/browser verification MIG-602/#847. |
| **FEATURE VERIFIED** | MIG-602/#847 + MIG-600/#845. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

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

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-311`
- Design: `.qa/design/migration-issues/stack-migration-mig-311.md`
- Status: waiting
- Reihenfolge: 77; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-077`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-311.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

