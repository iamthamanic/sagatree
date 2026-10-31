<!-- migration-contract:v2 localId=MIG-307 -->
# MIG-307: Port infrastructure/npc-creature adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/npc-creature: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/npc-creature: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts`, `src/domains/npc-creature/contracts.ts`, `src/domains/npc-creature/controller-assignment.ts`, `src/domains/npc-creature/core-catalog.ts`, `src/domains/npc-creature/definition.ts`, `src/domains/npc-creature/derived.ts`, `src/domains/npc-creature/icon-assets.ts`, `src/domains/npc-creature/index.ts`, `src/domains/npc-creature/instance.ts`, `src/domains/npc-creature/library-query.ts`, `src/domains/npc-creature/pack.ts`, `src/domains/npc-creature/packs/animals.ts`, `src/domains/npc-creature/packs/build-builtin.ts`, `src/domains/npc-creature/packs/context-packs.ts`, `src/domains/npc-creature/packs/fantasy-basics.ts`, `src/domains/npc-creature/packs/index.ts`, `src/domains/npc-creature/parse.ts`, `src/domains/npc-creature/payload.ts`, `src/domains/npc-creature/policy.ts`, `src/domains/npc-creature/promotion.ts`, `src/domains/npc-creature/taxonomy.ts`, `src/domains/npc-creature/validate.ts`, `src/domains/npc-creature/world-catalog.ts`, `src/domains/rules/sagatree/attribute-progression/index.ts`, `src/domains/rules/sagatree/character-creation/index.ts`, `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts`, `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts`, `src/domains/rules/sagatree/npc-creature-power/compute.ts`, `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts`, `src/domains/rules/sagatree/npc-creature-power/index.ts`, `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts`, `src/domains/rules/sagatree/npc-creature-power/profiles.ts`, `src/domains/rules/sagatree/npc-creature-power/types.ts`, `src/infrastructure/npc-creature/host-npc-creature-adapter.ts`, `src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts`, `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`, `src/infrastructure/npc-creature/npc-creature-service.ts`, `src/infrastructure/npc-creature/npc-creature.persistence.ts`, `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`.
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

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Create/read/update allowed definitions; spawn/update/remove session instance through documented RPC and reload.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Assign/revoke controller and clear only session-scoped temporary controllers; wrong owner/player mutation denied.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for assign_npc_creature_controller: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for clear_npc_creature_instance_temp_controllers_for_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for remove_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for spawn_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für npc-creature und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für npc-creature ausführt
- Dann: Contract fixture for update_npc_creature_instance_runtime: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Quelle: `.qa/intake/edge-infra-contracts/infra-npc-creature.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-npc-creature.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Create/read/update allowed definitions; spawn/update/remove session instance through documented RPC and reload.
2. Assign/revoke controller and clear only session-scoped temporary controllers; wrong owner/player mutation denied.
3. Contract fixture for assign_npc_creature_controller: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
4. Contract fixture for clear_npc_creature_instance_temp_controllers_for_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
5. Contract fixture for remove_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
6. Contract fixture for spawn_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
7. Contract fixture for update_npc_creature_instance_runtime: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
8. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 7 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #877 (RPC-NPC-INSTANCES)
- Depends on #793 (MIG-014)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-307`
- Design: `.qa/design/migration-issues/stack-migration-mig-307.md`
- Status: done
- Reihenfolge: 73; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-073`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-307.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

