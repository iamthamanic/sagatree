<!-- migration-contract:v2 localId=MIG-010 -->
# MIG-010: Node host skeleton (health, config, data dir)

## Type

Task

## Intent

Einen konfigurierbaren lokalen Node-Host als Modular Monolith mit ehrlicher Readiness, geordnetem Lebenszyklus und zentralem Composition-Root bereitstellen.

## Goal

Einen konfigurierbaren lokalen Node-Host als Modular Monolith mit ehrlicher Readiness, geordnetem Lebenszyklus und zentralem Composition-Root bereitstellen. Zielpfade: server/src/bootstrap, server/src/config, server/src/modules, server/src/application, server/src/http/route-registry.ts, scripts/architecture-boundary-check.mjs, scripts/architecture-boundary-check.self-test.mjs.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/lib/supabase.ts, docs/architektur-sqlite-based.md, docs/architecture/host-modular-monolith.md. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Einen konfigurierbaren lokalen Node-Host als Modular Monolith mit ehrlicher Readiness, geordnetem Lebenszyklus und zentralem Composition-Root bereitstellen. Zielpfade: server/src/bootstrap, server/src/config, server/src/modules, server/src/application, server/src/http/route-registry.ts, scripts/architecture-boundary-check.mjs, scripts/architecture-boundary-check.self-test.mjs.

## Scope

- Quellpfade: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`
- Änderbare Zielpfade: `server/src/bootstrap`, `server/src/config`, `server/src/modules`, `server/src/application`, `server/src/http/route-registry.ts`, `scripts/architecture-boundary-check.mjs`, `scripts/architecture-boundary-check.self-test.mjs`
- Quellverträge: `src/lib/supabase.ts`, `docs/architektur-sqlite-based.md`, `docs/architecture/host-modular-monolith.md`

## Security & Data

Standard-Listener bleibt Loopback; Remote-Bind benötigt explizite Konfiguration. Health-Ausgaben enthalten keine Tokens, Schlüssel oder Dateiinhalte. Modulgrenzen und Repository-Ownership aus docs/architecture/host-modular-monolith.md sind verbindlich; ORM-Wahl (GATE-01) ersetzt sie nicht.

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

## Acceptance

- [ ] Der Host meldet Readiness erst nach erfolgreicher Initialisierung und verwendet nach Neustart dasselbe Datenverzeichnis.
- [ ] Der Prozess endet mit Fehlercode und einer redigierten Ursache; er meldet nicht fälschlich gesund und weicht nicht still auf ein neues Verzeichnis aus.
- [ ] Neue Mutationen werden abgewiesen, bereits bestätigte Daten bleiben erhalten und Listener/DB-Ressourcen werden geschlossen.
- [ ] server/ ist registriert; Bootstrap verdrahtet identity/permissions/domain-Module zentral; öffentliche Modul-APIs sind von privaten persistence/internal-Pfaden getrennt; checkRegisteredHostPackages in scripts/architecture-boundary-check.mjs (Self-Test + npm run test-gate) weist relative Private-Cross-Imports, Modulzyklen und nicht-composition http/**-Zugriffe ab und läuft zusätzlich zu späteren ORM-Import-Verboten; keine Ambient-Service-Locator nach Ready.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)
- Depends on #784 (GATE-01)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-010`
- Design: `.qa/design/migration-issues/stack-migration-mig-010.md`
- Status: blocked
- Reihenfolge: 8; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-008`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-010.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
