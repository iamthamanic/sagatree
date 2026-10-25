<!-- migration-contract:v2 localId=MIG-402 -->
# MIG-402: Port Edge Function `ai-provider-credentials` to Node host service/adapter

## Type

feature

## Intent

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. ollama-settings: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

ai-provider-credentials: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. ollama-settings: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/ai-provider-credentials/, server/src/application/ollama-settings/.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/ai/ai-provider-credentials-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-meshy.ts`, `supabase/functions/_shared/ai-provider-registry.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/ai-provider-credentials/index.ts`, `supabase/functions/main/index.ts`, `src/infrastructure/ai/ollama-settings-service.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/ollama-settings/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`, `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/ai-provider-credentials/`
- `server/src/application/ollama-settings/`

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

- ai-provider-credentials: After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every credential read/update/delete filters user_id = that userId; inserts set it server-side. Meshy is the only catalog provider. No owner from request is trusted. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. ollama-settings: After dispatcher JWT validation, GET /auth/v1/user authenticates the end-user. Every read/write filters user_id = that userId. No project/session membership is required. Custom base URLs must pass SSRF allowlist checks; plaintext API keys are accepted only on write and stored encrypted. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- (Acceptance/Regression, sperrt READY nicht) Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.
- (Acceptance/Regression, sperrt READY nicht) No dedicated MIG-4xx GitHub identity yet; bound to MIG-402/#818 to preserve the fixed 90-issue registry after #879. Dedicated ticket allocation is a human decision, not agent inventing identities.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Ninth upsert/refresh inside the default 60s window returns 429, list/delete do not consume quota; store failure must not call Meshy.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Missing encryption key yields 503, rejected key yields 400; upsert preserves added_at and delete of absent own row succeeds.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für ai-provider-credentials und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-provider-credentials ausführt
- Dann: Inject refresh persistence failure: record current ignored PATCH behavior and require explicit successor error contract; never claim key refresh was durably stored from response alone.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Account O can get/upsert/test/listModels its Ollama prefs without project membership; account X never reads or mutates O's row.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 7

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Responses never include apiKey or secret_ciphertext; only hasApiKey/keyHint and rounded status fields.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 8

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Ninth upsert/test/listModels inside the default 60s window returns 429; get does not consume quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 9

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Rejected custom base URL fails before outbound fetch; missing encryption key yields 503 on decrypt/encrypt paths.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 10

- Gegeben: Der eingefrorene Quellvertrag für ollama-settings und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ollama-settings ausführt
- Dann: Co-ownership with MIG-402/#818 is inventory-only until a human allocates a dedicated Edge ticket; do not silently retire ai-provider-credentials.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 11

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`, `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

### Fall 12

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: No dedicated MIG-4xx GitHub identity yet; bound to MIG-402/#818 to preserve the fixed 90-issue registry after #879. Dedicated ticket allocation is a human decision, not agent inventing identities.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-provider-credentials.json`, `.qa/intake/edge-infra-contracts/edge-ollama-settings.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ollama-settings.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Account O can list/upsert/refresh/delete its Meshy key without project membership; account X never sees or modifies O's key.
2. List/upsert/refresh responses omit apiKey and secret_ciphertext; only rounded nonnegative credits are exposed.
3. Ninth upsert/refresh inside the default 60s window returns 429, list/delete do not consume quota; store failure must not call Meshy.
4. Missing encryption key yields 503, rejected key yields 400; upsert preserves added_at and delete of absent own row succeeds.
5. Inject refresh persistence failure: record current ignored PATCH behavior and require explicit successor error contract; never claim key refresh was durably stored from response alone.
6. Account O can get/upsert/test/listModels its Ollama prefs without project membership; account X never reads or mutates O's row.
7. Responses never include apiKey or secret_ciphertext; only hasApiKey/keyHint and rounded status fields.
8. Ninth upsert/test/listModels inside the default 60s window returns 429; get does not consume quota.
9. Rejected custom base URL fails before outbound fetch; missing encryption key yields 503 on decrypt/encrypt paths.
10. Co-ownership with MIG-402/#818 is inventory-only until a human allocates a dedicated Edge ticket; do not silently retire ai-provider-credentials.
11. Verpflichtende Legacy-Regression: Refresh PATCH responses are ignored; list DB errors become an empty credential list. Successor failure semantics require an explicit test-backed decision, not a silent compatibility assumption.
12. Verpflichtende Legacy-Regression: No dedicated MIG-4xx GitHub identity yet; bound to MIG-402/#818 to preserve the fixed 90-issue registry after #879. Dedicated ticket allocation is a human decision, not agent inventing identities.
13. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 12 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/ai-provider-credentials/`, `server/src/application/ollama-settings/` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | authorized host routes + MIG-600 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #791 (MIG-012)
- Depends on #841 (MIG-500)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-402`
- Design: `.qa/design/migration-issues/stack-migration-mig-402.md`
- Status: ready
- Reihenfolge: 43; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-043`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-402.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Owned internal prerequisites

- `consume_ai_provider_credential_rate_limit`

Diese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.

