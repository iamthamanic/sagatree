<!-- migration-contract:v2 localId=MIG-409 -->
# MIG-409: Port Edge Function `item-model3d` to Node host service/adapter

## Type

feature

## Intent

item-model3d: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

item-model3d: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/item-model3d/.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/inventory/item-model3d-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-resolve-meshy.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/item-model3d-glb.ts`, `supabase/functions/_shared/item-model3d-meshy.ts`, `supabase/functions/_shared/item-model3d-rate-limit.ts`, `supabase/functions/_shared/item-thumbnail-image.ts`, `supabase/functions/item-model3d/index.ts`, `supabase/functions/main/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/item-model3d/`

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

- item-model3d: Authenticate /auth/v1/user. Definition must be active: personal.owner_user_id===caller, or world_profiles.owner_user_id===caller for world scope. Project membership/GM role is insufficient. status/latest-job filter owner_user_id. resolve allows asset owner or referenced world-profile owner. remove clears pointer but only deletes physical asset owned by caller. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- (Acceptance/Regression, sperrt READY nicht) Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
- (Acceptance/Regression, sperrt READY nicht) Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.
- (Acceptance/Regression, sperrt READY nicht) GLB validator checks magic, size and MIME only; it does not validate GLB version/declared length/chunk structure.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Personal owner and world-profile owner can upload valid GLB<=50MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: generate consumes 2/60s per user; request3429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Each action returns its exact documented union; model3d uses model3d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Foreign jobId404, foreign resolve403; remove of absent pointer succeeds and cannot delete a different owner's object; traversal/off-allowlist provider redirect/oversize asset never materializes.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 6

- Gegeben: Der eingefrorene Quellvertrag für item-model3d und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für item-model3d ausführt
- Dann: Provider failure and unchecked job PATCH persistence failure are distinguished in the tested successor contract; no API keys in public failure bodies.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 7

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 8

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

### Fall 9

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: GLB validator checks magic, size and MIME only; it does not validate GLB version/declared length/chunk structure.
- Quelle: `.qa/intake/edge-infra-contracts/edge-item-model3d.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-item-model3d.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Personal owner and world-profile owner can upload valid GLB<=50MiB; distinct GM/member/foreign user403, archived definition403; no unauthorized storage/provider call.
2. generate consumes 2/60s per user; request3429, unavailable quota store500 and no paid provider create; config/upload/status/resolve/remove/latest do not charge generation quota.
3. Each action returns its exact documented union; model3d uses model3d:, undefined fields omitted, signed URL lifetime604800s, latest-job null when absent.
4. Concurrent status requests and provider-create/DB-insert failure must have explicit successor idempotency/compensation semantics; the current code does not guarantee single materialization or rollback.
5. Foreign jobId404, foreign resolve403; remove of absent pointer succeeds and cannot delete a different owner's object; traversal/off-allowlist provider redirect/oversize asset never materializes.
6. Provider failure and unchecked job PATCH persistence failure are distinguished in the tested successor contract; no API keys in public failure bodies.
7. Verpflichtende Legacy-Regression: Header-only body limit, paid create before insert, no status claim/idempotent materialization and several ignored PATCH statuses are observed source behavior; migration must make a tested decision for each.
8. Verpflichtende Legacy-Regression: Task error_message from provider is returned in job responses. Generic catch hides many other errors, but universal recursive provider-secret redaction is not implemented.
9. Verpflichtende Legacy-Regression: GLB validator checks magic, size and MIME only; it does not validate GLB version/declared length/chunk structure.
10. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 9 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/item-model3d/` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #841 (MIG-500)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-409`
- Design: `.qa/design/migration-issues/stack-migration-mig-409.md`
- Status: waiting
- Reihenfolge: 51; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-051`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-409.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Owned internal prerequisites

- `consume_item_model3d_rate_limit`

Diese Helper sind vollständig Teil dieses Tickets und benötigen eigene Sicherheits-/Atomizitätsnachweise.

