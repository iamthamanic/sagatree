<!-- migration-contract:v2 localId=MIG-401 -->
# MIG-401: Port Edge Function `ai-gm` to Node host service/adapter

## Type

feature

## Intent

ai-gm: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

ai-gm: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/functions/_shared/ai-gm-rate-limit.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/character-lore-prompt.ts`, `supabase/functions/_shared/character-lore-provider.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/ollama-llm-resolve.ts`, `supabase/functions/_shared/ollama-url-policy.ts`, `supabase/functions/_shared/session-membership-gate.ts`, `supabase/functions/ai-gm/index.ts`, `supabase/functions/main/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`.
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

- ai-gm: External dispatcher returns404 before worker creation. If directly invoked in an isolated fixture, assertSessionMemberAccess runs before persistent user quota and provider/lore fan-out; it does not establish a role-safe projection of caller-supplied NPC IDs/context. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- Unmounted; no public activation authorization. Role-safe NPC context, correct context-index pairing, durable world mutation, stream framing across chunks and error-stack redaction require explicit successor decisions.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ai-gm und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai-gm ausführt
- Dann: If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.
- Quelle: `.qa/intake/edge-infra-contracts/edge-ai-gm.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-ai-gm.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
2. Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
3. Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
4. If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
- [ ] Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
- [ ] Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
- [ ] If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-401`
- Design: `.qa/design/migration-issues/stack-migration-mig-401.md`
- Status: blocked
- Reihenfolge: 44; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-044`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-401.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Owned internal prerequisites

- `consume_ai_gm_rate_limit`

Diese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.

