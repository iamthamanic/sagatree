<!-- migration-contract:v2 localId=MIG-603 -->
# MIG-603: Ops: backup/restore/update/rollback runbooks

## Type

feature

## Intent

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren.

## Goal

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren. Zielpfade: docs/ops/host, scripts/host-backup.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`.
- Source Contracts: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `docs/ops/host`
- `scripts/host-backup`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Backups enthalten geschützte Daten und werden wie die Originaldaten autorisiert; Snapshot-Konsistenz darf nicht auf unkoordinierten Dateikopien beruhen.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Aktive Schreiblast und ein freigegebener Backup-Mechanismus
- Wenn: ein Snapshot erstellt und auf einem neuen Host restauriert wird
- Dann: SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

### Fall 2

- Gegeben: Datenträger voll oder abgebrochene Kopie
- Wenn: Backup/Restore ausgeführt wird
- Dann: Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

### Fall 3

- Gegeben: Ein fehlerhaftes Host-Update mit Testdaten
- Wenn: der dokumentierte Rollback-Drill folgt
- Dann: Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.
- Quelle: `docs/ops`, `docker-compose.yml`, `docs/architektur-sqlite-based.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.
2. Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.
3. Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.
- [ ] Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.
- [ ] Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #843 (MIG-502)
- Depends on #844 (MIG-503)
- Depends on #846 (MIG-601)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-603`
- Design: `.qa/design/migration-issues/stack-migration-mig-603.md`
- Status: waiting
- Reihenfolge: 85; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-085`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-603.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

