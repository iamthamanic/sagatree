<!-- migration-contract:v2 localId=MIG-404 -->
# MIG-404: Port Edge Function `character-avatar-meshy` to Node host service/adapter

## Type

feature

## Intent

character-avatar-meshy: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen.

## Goal

character-avatar-meshy: Den aktuell eingebundenen Worker mit denselben validierten Operationen am Host bereitstellen. Zielpfade: server/src/application/character-avatar-meshy/.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/character/avatar/character-avatar-meshy-service.ts`, `supabase/functions/_shared/ai-provider-crypto.ts`, `supabase/functions/_shared/ai-provider-resolve-meshy.ts`, `supabase/functions/_shared/avatar-3d-generation.ts`, `supabase/functions/_shared/avatar-meshy-rate-limit.ts`, `supabase/functions/_shared/avatar-meshy-remesh.ts`, `supabase/functions/_shared/avatar-meshy-rigging.ts`, `supabase/functions/_shared/avatar-meshy-text-to-3d.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/_shared/item-model3d-glb.ts`, `supabase/functions/_shared/item-model3d-meshy.ts`, `supabase/functions/character-avatar-meshy/index.ts`, `supabase/functions/main/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/character-avatar-meshy/`

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

- character-avatar-meshy: Authenticate via /auth/v1/user; jobs are read by owner_user_id. Optional characterId resolves only caller-owned character, otherwise null. Keys resolved from caller BYOK credential. Storage read/sign requires normalized caller userId/ prefix. Dispatcher-Status: {"kind":"allowlisted-worker","dispatcherAllowed":true,"publicActivationAuthorized":false,"decision":"Current branch mount; a successor cutover still requires gates and contract tests."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- start creates provider task before DB insert; replay key uses prompt length rather than content hash. Equal-length changed input may collide and concurrent starts may orphan a paid provider task. Successor cutover requires an explicit tested idempotency/compensation decision; current worker is allowlisted.
- meshyConfigured can be true from an active credential row without proving successful decryption; config is availability metadata, not a verified provider request. Avatar image validation checks data-URI grammar and approximate byte count, not decoded image magic.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Owner start/poll/retry works without project membership; account X jobId returns404 and cannot sign owner storage path.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Text8..500, nonce1..80,4MiB image and settings enums enforced; unsupported provider rejects400.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Identical start key replays existing own row, but third start attempt inside60s is429 even if replay; do not claim durable quota.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Two concurrent polls do not both start remesh/rig task; retry with existing provider task resumes without paid create.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für character-avatar-meshy und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character-avatar-meshy ausführt
- Dann: Provider failure is a provider_unavailable pseudo-job, missing provider not-configured; all GLB downloads/paths obey allowlist and size limits.
- Quelle: `.qa/intake/edge-infra-contracts/edge-character-avatar-meshy.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-character-avatar-meshy.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Owner start/poll/retry works without project membership; account X jobId returns404 and cannot sign owner storage path.
2. Text8..500, nonce1..80,4MiB image and settings enums enforced; unsupported provider rejects400.
3. Identical start key replays existing own row, but third start attempt inside60s is429 even if replay; do not claim durable quota.
4. Two concurrent polls do not both start remesh/rig task; retry with existing provider task resumes without paid create.
5. Provider failure is a provider_unavailable pseudo-job, missing provider not-configured; all GLB downloads/paths obey allowlist and size limits.
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #791 (MIG-012)
- Depends on #841 (MIG-500)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-404`
- Design: `.qa/design/migration-issues/stack-migration-mig-404.md`
- Status: blocked
- Reihenfolge: 46; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-046`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-404.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

