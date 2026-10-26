<!-- migration-contract:v2 localId=MIG-421 -->
# MIG-421: Port Edge Function `session-recap` to Node host service/adapter

## Type

feature

## Intent

session-recap: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

session-recap: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/session-recap/.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/session/session-recap-ai-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/_shared/session-recap-prompt.ts`, `supabase/functions/_shared/session-recap-provider.ts`, `supabase/functions/_shared/session-recap-rate-limit.ts`, `supabase/functions/main/index.ts`, `supabase/functions/session-recap/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/session-recap/`

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

- session-recap: Authenticated account must equal projects.gm_user_id for sessions.project_id. A project owner/member/GM label alone is not substituted for that equality. Session must be completed or cancelled. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Distinct owner O and project GM G: only G can generate a recap for an ended session; active member/player/foreign X denied.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: POST with client highlights/prompt/worldState/summaryText rejects400, and GM-only highlight sentinel never reaches provider.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Successful response coincides with persisted summary_status=draft; publication remains a separate RPC decision.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Non-ended session400, missing session404, eighth-thousand-and-first byte413; quota7 returns429.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für session-recap und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für session-recap ausführt
- Dann: Provider/persistence failure returns generic500 and never publishes stale or partial generated text.
- Quelle: `.qa/intake/edge-infra-contracts/edge-session-recap.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-session-recap.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Distinct owner O and project GM G: only G can generate a recap for an ended session; active member/player/foreign X denied.
2. POST with client highlights/prompt/worldState/summaryText rejects400, and GM-only highlight sentinel never reaches provider.
3. Successful response coincides with persisted summary_status=draft; publication remains a separate RPC decision.
4. Non-ended session400, missing session404, eighth-thousand-and-first byte413; quota7 returns429.
5. Provider/persistence failure returns generic500 and never publishes stale or partial generated text.
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/session-recap/` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | authorized host routes + MIG-600 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #870 (RPC-SESSION-RECAP)
- Depends on #791 (MIG-012)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-421`
- Design: `.qa/design/migration-issues/stack-migration-mig-421.md`
- Status: ready
- Reihenfolge: 62; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-062`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-421.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Owned internal prerequisites

- `consume_session_recap_rate_limit`

Diese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.

