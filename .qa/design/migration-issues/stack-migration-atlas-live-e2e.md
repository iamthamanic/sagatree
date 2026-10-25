<!-- migration-contract:v2 localId=ATLAS-LIVE-E2E -->
# ATLAS-LIVE-E2E: Mandatory Atlas live E2E on isolated test DB (GitHub #770)

## Type

bug

## Intent

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen.

## Goal

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen. Zielpfade: e2e/atlas-isolated-product.spec.ts, scripts/stack-migration-db, .github/workflows/stack-migration-baseline.yml.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`.
- Source Contracts: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `e2e/atlas-isolated-product.spec.ts`
- `scripts/stack-migration-db`
- `.github/workflows/stack-migration-baseline.yml`

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

- Die Testinstanz besitzt nur synthetische Daten. SQL-Proben, UI-Mocks und ein sichtbares Element werden nicht als vollständiger persistenter Produktpfad ausgegeben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- (Ausführungssperre) Atlas live product E2E CI remains not-passing on the isolated baseline workflow; known red must be fixed with real evidence before READY/DONE (do not skip or greenwash).

## Edge Cases

### Fall 1

- Gegeben: Weltbesitzer O, separater Projekt-GM G, P1/P2 und X auf einer isolierten Datenbank
- Wenn: der Browser Karten erstellt/ändert und Freigaben ausführt
- Dann: Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 2

- Gegeben: Geheime Atlas-Daten und ein fremder oder nicht berechtigter Actor
- Wenn: UI und Backend denselben Objektzugriff versuchen
- Dann: Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 3

- Gegeben: Eine absichtlich aufgeweitete Atlas-Projektionsberechtigung
- Wenn: das verpflichtende CI-Gate läuft
- Dann: Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.
- Quelle: `e2e/atlas-followup-product-e2e-gate.spec.ts`, `.qa/design/atlas-live-e2e-cutover-gate.md`, `src/infrastructure/world/world-atlas-service.ts`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
2. Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
3. Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
- [ ] Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
- [ ] Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated Atlas product journey CI gate. |
| **Acceptance tier** | `feature-e2e` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | Known-red until suite PASS; not greenwashed. |
| **FEATURE VERIFIED** | self when CI acceptance passes. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #782 (MIG-001)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-atlas-live-e2e`
- Design: `.qa/design/migration-issues/stack-migration-atlas-live-e2e.md`
- Status: blocked
- Reihenfolge: 2; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-002`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-atlas-live-e2e.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

