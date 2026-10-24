<!-- migration-contract:v2 localId=MIG-304 -->
# MIG-304: Port infrastructure/look adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/look: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/look: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/character/avatar/mtoon-profile.ts`, `src/domains/look/advanced-adaption.ts`, `src/domains/look/advanced-look-capability-status.ts`, `src/domains/look/advanced-look-provider-registry.ts`, `src/domains/look/capability-metadata.ts`, `src/domains/look/index.ts`, `src/domains/look/invariants.ts`, `src/domains/look/library-query.ts`, `src/domains/look/parse.ts`, `src/domains/look/persistence-contracts.ts`, `src/domains/look/personal-look-override.ts`, `src/domains/look/reference-analysis.ts`, `src/domains/look/resolve.ts`, `src/domains/look/system-default.ts`, `src/domains/look/types.ts`, `src/domains/look/write-draft.ts`, `src/infrastructure/character/avatar/mtoon-style-applier.ts`, `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts`, `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts`, `src/infrastructure/look/adapters/toonlab-look-adapter.ts`, `src/infrastructure/look/index.ts`, `src/infrastructure/look/look-material-roles.ts`, `src/infrastructure/look/look-reference-analysis-service.ts`, `src/infrastructure/look/look-runtime-types.ts`, `src/infrastructure/look/look-runtime.ts`, `src/infrastructure/look/look-service.ts`, `src/infrastructure/look/look.persistence.ts`, `src/infrastructure/look/supabase-look.repository.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`.
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

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für look und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für look ausführt
- Dann: Local look runtime adapters remain unchanged by persistence transport replacement.
- Quelle: `.qa/intake/edge-infra-contracts/infra-look.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-look.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
2. Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
3. Local look runtime adapters remain unchanged by persistence transport replacement.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- [ ] Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- [ ] Local look runtime adapters remain unchanged by persistence transport replacement.
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

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #828 (MIG-412)
- Depends on #793 (MIG-014)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-304`
- Design: `.qa/design/migration-issues/stack-migration-mig-304.md`
- Status: waiting
- Reihenfolge: 70; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-070`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-304.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Integration peers

- #801 (MIG-302)

Gemeinsame Ports bleiben stabil, Integrationsabnahme in MIG-600; keine zyklischen Startverbote.

