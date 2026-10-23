<!-- migration-contract:v2 localId=MIG-310 -->
# MIG-310: Port infrastructure/saga adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/saga: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/saga: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/saga/contracts/saga-definition.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`.
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

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for copy_native_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for create_project_from_saga_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for create_user_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for duplicate_saga_playthrough: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 8

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for get_native_saga_definition_by_slug: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 9

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for get_saga_definition_editor: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 10

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for get_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 11

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for promote_session_outcome_to_saga: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 12

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for promote_session_outcome_to_world: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 13

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for publish_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

### Fall 14

- Gegeben: Der eingefrorene Quellvertrag für saga und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für saga ausführt
- Dann: Contract fixture for save_saga_definition_draft: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-saga.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-saga.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
2. Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
3. All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.
4. Contract fixture for copy_native_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
5. Contract fixture for create_project_from_saga_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
6. Contract fixture for create_user_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
7. Contract fixture for duplicate_saga_playthrough: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
8. Contract fixture for get_native_saga_definition_by_slug: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
9. Contract fixture for get_saga_definition_editor: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
10. Contract fixture for get_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
11. Contract fixture for promote_session_outcome_to_saga: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
12. Contract fixture for promote_session_outcome_to_world: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
13. Contract fixture for publish_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
14. Contract fixture for save_saga_definition_draft: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
15. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 14 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #871 (RPC-SAGA-AUTHORING)
- Depends on #873 (RPC-SAGA-PROVISION)
- Depends on #872 (RPC-SAGA-VERSION-READ)
- Depends on #876 (RPC-SAGA-PROJECTIONS)
- Depends on #793 (MIG-014)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-310`
- Design: `.qa/design/migration-issues/stack-migration-mig-310.md`
- Status: waiting
- Reihenfolge: 76; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-076`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-310.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

