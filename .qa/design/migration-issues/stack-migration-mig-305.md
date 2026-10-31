<!-- migration-contract:v2 localId=MIG-305 -->
# MIG-305: Port infrastructure/marketplace adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/marketplace: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/marketplace: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/marketplace/client-trust.ts`, `src/domains/marketplace/contracts/marketplace.types.ts`, `src/infrastructure/marketplace/marketplace-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`.
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

- (Acceptance/Regression, sperrt READY nicht) incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
- (Acceptance/Regression, sperrt READY nicht) Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.

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

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

### Fall 6

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.
- Quelle: `.qa/intake/edge-infra-contracts/infra-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-marketplace.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. List filters, sort defaults, single-read errors and featured fallback retain exact request/result behavior.
2. RPC increment succeeds atomically when installed; unavailable/denied RPC exercises read+update fallback and explicitly reports race, RLS and swallowed-error behavior.
3. Create cannot use a client author_id; update/delete foreign-author attempts are denied by effective server policy; delete returnsfalse on its documented failures.
4. Contract fixture for increment_marketplace_downloads: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
5. Verpflichtende Legacy-Regression: incrementDownloads uses non-atomic direct-table fallback for every RPC error and ignores fallback write results; fulfilled Promise<void> does not prove a stored increment.
6. Verpflichtende Legacy-Regression: Search string is interpolated into PostgREST or expression; successor parser/escaping behavior must be decided and tested.
7. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 6 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/marketplace/client-trust.ts`, `src/domains/marketplace/contracts/marketplace.types.ts`, `src/infrastructure/marketplace/marketplace-service.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #878 (RPC-MARKETPLACE-COUNT)
- Depends on #793 (MIG-014)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-305`
- Design: `.qa/design/migration-issues/stack-migration-mig-305.md`
- Status: ready
- Reihenfolge: 71; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-071`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-305.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

