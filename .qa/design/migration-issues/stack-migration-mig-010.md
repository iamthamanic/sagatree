<!-- migration-contract:v2 localId=MIG-010 -->
# MIG-010: Node host skeleton (health, config, data dir)

## Type

feature

## Intent

Einen konfigurierbaren lokalen Node-Host als Modular Monolith mit ehrlicher Readiness, geordnetem Lebenszyklus und zentralem Composition-Root bereitstellen.

## Goal

Einen konfigurierbaren lokalen Node-Host als Modular Monolith mit ehrlicher Readiness, geordnetem Lebenszyklus und zentralem Composition-Root bereitstellen. Zielpfade: server/src/bootstrap, server/src/config, server/src/modules, server/src/application, server/src/http/route-registry.ts, scripts/architecture-boundary-check.mjs, scripts/architecture-boundary-check.self-test.mjs.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`.
- Source Contracts: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/bootstrap`
- `server/src/config`
- `server/src/modules`
- `server/src/application`
- `server/src/http/route-registry.ts`
- `scripts/architecture-boundary-check.mjs`
- `scripts/architecture-boundary-check.self-test.mjs`

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

- Standard-Listener bleibt Loopback; Remote-Bind benötigt explizite Konfiguration. Health-Ausgaben enthalten keine Tokens, Schlüssel oder Dateiinhalte. Modulgrenzen und Repository-Ownership aus docs/architecture/host-modular-monolith.md sind verbindlich; ORM-Wahl (GATE-01) ersetzt sie nicht.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein leeres, beschreibbares Datenverzeichnis und keine Cloud-Credentials
- Wenn: der Host im Solo-Modus startet
- Dann: Der Host meldet Readiness erst nach erfolgreicher Initialisierung und verwendet nach Neustart dasselbe Datenverzeichnis.
- Quelle: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: Ungültige Konfiguration, belegter Port oder nicht beschreibbares Datenverzeichnis
- Wenn: der Host startet
- Dann: Der Prozess endet mit Fehlercode und einer redigierten Ursache; er meldet nicht fälschlich gesund und weicht nicht still auf ein neues Verzeichnis aus.
- Quelle: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: Laufende Requests und ein Terminationssignal
- Wenn: der Host herunterfährt
- Dann: Neue Mutationen werden abgewiesen, bereits bestätigte Daten bleiben erhalten und Listener/DB-Ressourcen werden geschlossen.
- Quelle: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Der verbindliche Host-Modulvertrag und die Repository-Architekturregeln
- Wenn: MIG-010 den Composition-Root und die Modul-DAG verdrahtet
- Dann: server/ ist registriert; Bootstrap verdrahtet identity/permissions/domain-Module zentral; öffentliche Modul-APIs sind von privaten persistence/internal-Pfaden getrennt; checkRegisteredHostPackages in scripts/architecture-boundary-check.mjs (Self-Test + npm run test-gate) weist relative Private-Cross-Imports, Modulzyklen und nicht-composition http/**-Zugriffe ab und läuft zusätzlich zu späteren ORM-Import-Verboten; keine Ambient-Service-Locator nach Ready.
- Quelle: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Der Host meldet Readiness erst nach erfolgreicher Initialisierung und verwendet nach Neustart dasselbe Datenverzeichnis.
2. Der Prozess endet mit Fehlercode und einer redigierten Ursache; er meldet nicht fälschlich gesund und weicht nicht still auf ein neues Verzeichnis aus.
3. Neue Mutationen werden abgewiesen, bereits bestätigte Daten bleiben erhalten und Listener/DB-Ressourcen werden geschlossen.
4. server/ ist registriert; Bootstrap verdrahtet identity/permissions/domain-Module zentral; öffentliche Modul-APIs sind von privaten persistence/internal-Pfaden getrennt; checkRegisteredHostPackages in scripts/architecture-boundary-check.mjs (Self-Test + npm run test-gate) weist relative Private-Cross-Imports, Modulzyklen und nicht-composition http/**-Zugriffe ab und läuft zusätzlich zu späteren ORM-Import-Verboten; keine Ambient-Service-Locator nach Ready.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Der Host meldet Readiness erst nach erfolgreicher Initialisierung und verwendet nach Neustart dasselbe Datenverzeichnis.
- [ ] Der Prozess endet mit Fehlercode und einer redigierten Ursache; er meldet nicht fälschlich gesund und weicht nicht still auf ein neues Verzeichnis aus.
- [ ] Neue Mutationen werden abgewiesen, bereits bestätigte Daten bleiben erhalten und Listener/DB-Ressourcen werden geschlossen.
- [ ] server/ ist registriert; Bootstrap verdrahtet identity/permissions/domain-Module zentral; öffentliche Modul-APIs sind von privaten persistence/internal-Pfaden getrennt; checkRegisteredHostPackages in scripts/architecture-boundary-check.mjs (Self-Test + npm run test-gate) weist relative Private-Cross-Imports, Modulzyklen und nicht-composition http/**-Zugriffe ab und läuft zusätzlich zu späteren ORM-Import-Verboten; keine Ambient-Service-Locator nach Ready.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/bootstrap`, `server/src/config`, `server/src/modules` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)
- Depends on #784 (GATE-01)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-010`
- Design: `.qa/design/migration-issues/stack-migration-mig-010.md`
- Status: done
- Reihenfolge: 8; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-008`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-010.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

