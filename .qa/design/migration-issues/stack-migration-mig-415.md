<!-- migration-contract:v2 localId=MIG-415 -->
# MIG-415: Port Edge Function `marketplace` to Node host service/adapter

## Type

feature

## Intent

marketplace: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

marketplace: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/marketplace/index.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`.
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

- marketplace: Dispatcher denies marketplace with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- Rating average uses downloads as vote count and accepts unbounded caller rating; no author/owner authorization or persistence.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: marketplace worker stays404 including download/rate.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für marketplace und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für marketplace ausführt
- Dann: Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.
- Quelle: `.qa/intake/edge-infra-contracts/edge-marketplace.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-marketplace.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. marketplace worker stays404 including download/rate.
2. Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
3. Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] marketplace worker stays404 including download/rate.
- [ ] Isolated fixture pins list/search/tag filtering, count increment and rating denominator; no numeric-rating validation is claimed.
- [ ] Persistent marketplace_items and increment_marketplace_downloads migration remains linked to infrastructure/marketplace; no substitution by legacy Map worker.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | authorized host routes + MIG-600 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-415`
- Design: `.qa/design/migration-issues/stack-migration-mig-415.md`
- Status: blocked
- Reihenfolge: 56; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-056`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-415.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

