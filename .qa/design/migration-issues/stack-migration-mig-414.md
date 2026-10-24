<!-- migration-contract:v2 localId=MIG-414 -->
# MIG-414: Port Edge Function `main` to Node host service/adapter

## Type

feature

## Intent

main: Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen.

## Goal

main: Nur die aktuell eingebundenen Worker über den zentralen Dispatcher erreichbar machen. Zielpfade: server/src/http/route-registry.ts.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/http/route-registry.ts`

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

- main: Resolve /functions/v1/<name>/suffix or /<name>/suffix; no name400. Deny every name outside the explicit eight-worker allowlist and reserved main/_shared, including traversal, with404 BEFORE JWT and worker creation. Allowed non-OPTIONS verifies HS256 with JWT_SECRET unless VERIFY_JWT=false|0|no; allowed worker authenticates end-user separately. Dispatcher-Status: {"kind":"dispatcher","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve exact dispatch boundary until host cutover."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- Dispatcher verifies signature and optional exp but not complete JWT claims; worker-side account authentication remains mandatory. Raw exception messages can escape in500 body.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

### Fall 5

- Gegeben: Der eingefrorene Quellvertrag für main und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für main ausführt
- Dann: Preserve512MiB/300s worker resource limits and record existing dispatcher raw-message error behavior.
- Quelle: `.qa/intake/edge-infra-contracts/edge-main.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-main.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
2. Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
3. Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
4. JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
5. Preserve512MiB/300s worker resource limits and record existing dispatcher raw-message error behavior.
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/http/route-registry.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #818 (MIG-402)
- Depends on #820 (MIG-404)
- Depends on #821 (MIG-405)
- Depends on #825 (MIG-409)
- Depends on #826 (MIG-410)
- Depends on #828 (MIG-412)
- Depends on #836 (MIG-420)
- Depends on #837 (MIG-421)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-414`
- Design: `.qa/design/migration-issues/stack-migration-mig-414.md`
- Status: blocked
- Reihenfolge: 63; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-063`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-414.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

