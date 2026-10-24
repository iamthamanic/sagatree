<!-- migration-contract:v2 localId=MIG-020 -->
# MIG-020: HTTP command/query transport layer

## Type

feature

## Intent

Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten.

## Goal

Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten. Zielpfade: server/src/api, server/src/application.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`.
- Source Contracts: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/api`
- `server/src/application`

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

- Der Server validiert Payload und Actor vor Anwendungsmutationen; 401/403/409/422 sind kein Ersatz für eine echte Policy-Prüfung.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein gültiger Actor und ein freigegebenes Command-DTO
- Wenn: der Request den HTTP-Einstieg erreicht
- Dann: Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 2

- Gegeben: Fehlende Anmeldung, fehlendes Recht, veraltete Revision und ungültiger Payload
- Wenn: die vier Requests ausgeführt werden
- Dann: Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 3

- Gegeben: Ein verlorener HTTP-Response nach erfolgreichem Commit
- Wenn: der Client denselben idempotenten Request wiederholt
- Dann: Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `src/infrastructure/world/world-atlas-service.ts`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.
2. Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.
3. Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.
- [ ] Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.
- [ ] Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Typed Hono HTTP command/query pipeline with revision/idempotency and role-scoped transport projection of gmNotes. |
| **Acceptance tier** | `host-integration` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | Realtime room join/resync/fan-out is MIG-021/#796; Colyseus Room product surface + browser E2E MIG-602/#847. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #789 (MIG-010)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #786 (GATE-03)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-020`
- Design: `.qa/design/migration-issues/stack-migration-mig-020.md`
- Status: done
- Reihenfolge: 15; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-015`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-020.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

