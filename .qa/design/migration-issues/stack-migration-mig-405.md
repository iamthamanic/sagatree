<!-- migration-contract:v2 localId=MIG-405 -->
# MIG-405: Port Edge Function `character-lore` to Node host service/adapter

## Type

feature

## Intent

character-lore: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

character-lore: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-lore/.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/character/character-lore-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-access.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/character-lore-rate-limit.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/character-lore/index.ts`, `supabase/functions/main/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/character-lore/`

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

- character-lore: Authenticate via /auth/v1/user. Optional projectId requires project GM or active project_members; optional worldId must match project.world_id when both supplied. World lore is allowed if public or creator_user_id equals project GM (project-linked) / caller (direct reference). This is not a blanket GM-only endpoint. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- Reference-authorization denials currently use generic500, not403; preserve or explicitly revise this documented error behavior.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: An owner direct-world request and an active member request to their GM-owned project world generate; unrelated private-world and mismatched project/world requests fail before provider context inclusion.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: 128001-byte body rejected; parser truncates/clamps each documented field and rejects ruleset/UUID enum violations.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Provider absence returns HTTP200 not-configured; output is a draft and no characters row is mutated.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Seventh request inside default window returns429; missing persistent store returns503 before provider use.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für character-lore und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-lore ausführt
- Dann: Generated story is nonempty and <=12000, and errors do not return provider/API secrets.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-lore.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-lore.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. An owner direct-world request and an active member request to their GM-owned project world generate; unrelated private-world and mismatched project/world requests fail before provider context inclusion.
2. 128001-byte body rejected; parser truncates/clamps each documented field and rejects ruleset/UUID enum violations.
3. Provider absence returns HTTP200 not-configured; output is a draft and no characters row is mutated.
4. Seventh request inside default window returns429; missing persistent store returns503 before provider use.
5. Generated story is nonempty and <=12000, and errors do not return provider/API secrets.
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/character-lore/` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | authorized host routes + MIG-600 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-405`
- Design: `.qa/design/migration-issues/stack-migration-mig-405.md`
- Status: blocked
- Reihenfolge: 47; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-047`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-405.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Owned internal prerequisites

- `consume_character_lore_rate_limit`

Diese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.

