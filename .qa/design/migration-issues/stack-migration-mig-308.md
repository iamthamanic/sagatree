<!-- migration-contract:v2 localId=MIG-308 -->
# MIG-308: Port infrastructure/project adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/project: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/project: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/project/contracts/project.types.ts`, `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/catalog.ts`, `src/domains/saga/permissions/index.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-lifecycle.ts`, `src/infrastructure/host/host-library-http.ts`, `src/infrastructure/host/host-project-http.ts`, `src/infrastructure/host/host-session-http.ts`, `src/infrastructure/project/host-project-adapter.ts`, `src/infrastructure/project/host-project-ports.contract.ts`, `src/infrastructure/project/project-member-service.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/project/saga-permission-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/hostAuthBridge.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`.
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

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: Create project/session,join by code,assign own eligible character and reload overview.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für project und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für project ausführt
- Dann: Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
- Quelle: `.qa/intake/edge-infra-contracts/infra-project.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-project.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Create project/session,join by code,assign own eligible character and reload overview.
2. All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
3. Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Create project/session,join by code,assign own eligible character and reload overview.
- [ ] All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- [ ] Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/project/contracts/project.types.ts`, `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/catalog.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #793 (MIG-014)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-308`
- Design: `.qa/design/migration-issues/stack-migration-mig-308.md`
- Status: done
- Reihenfolge: 74; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-074`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-308.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

