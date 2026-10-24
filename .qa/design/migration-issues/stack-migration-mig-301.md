<!-- migration-contract:v2 localId=MIG-301 -->
# MIG-301: Port infrastructure/ai adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/ai: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/ai: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/ai-providers/contracts.ts`, `src/domains/ai-providers/index.ts`, `src/domains/ai-providers/ollama-settings.ts`, `src/infrastructure/ai/ai-provider-credentials-service.ts`, `src/infrastructure/ai/ollama-settings-service.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-ai.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-ai.json`.
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

- Gegeben: Der eingefrorene Quellvertrag für ai und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai ausführt
- Dann: List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
- Quelle: `.qa/intake/edge-infra-contracts/infra-ai.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-ai.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ai und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai ausführt
- Dann: Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
- Quelle: `.qa/intake/edge-infra-contracts/infra-ai.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-ai.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ai und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ai ausführt
- Dann: Foreign account cannot list or mutate owner credentials; missing session fails before invoke.
- Quelle: `.qa/intake/edge-infra-contracts/infra-ai.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-ai.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
2. Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
3. Foreign account cannot list or mutate owner credentials; missing session fails before invoke.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] List/add/refresh/delete preserve typed public credential view and expose provider errors without key leakage.
- [ ] Ollama Organize get/upsert/test/listModels preserve typed settings view without apiKey leakage; foreign account cannot mutate owner prefs.
- [ ] Foreign account cannot list or mutate owner credentials; missing session fails before invoke.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/ai-providers/contracts.ts`, `src/domains/ai-providers/index.ts`, `src/domains/ai-providers/ollama-settings.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #818 (MIG-402)
- Depends on #793 (MIG-014)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-301`
- Design: `.qa/design/migration-issues/stack-migration-mig-301.md`
- Status: waiting
- Reihenfolge: 67; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-067`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-301.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

