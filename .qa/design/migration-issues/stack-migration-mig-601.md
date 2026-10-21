<!-- migration-contract:v2 localId=MIG-601 -->
# MIG-601: Docker Compose simplification for host+optional AI/media

## Type

Task

## Intent

Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen.

## Goal

Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen. Zielpfade: deployment, docs/ops.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: docker-compose.yml, .github/workflows/verify.yml. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen. Zielpfade: deployment, docs/ops.

## Scope

- Quellpfade: `docker-compose.yml`, `.github/workflows/verify.yml`
- Änderbare Zielpfade: `deployment`, `docs/ops`
- Quellverträge: `docker-compose.yml`, `.github/workflows/verify.yml`

## Security & Data

Host-only benötigt keine Cloud-Secrets; optionale Provider-Credentials werden extern injiziert und nicht in Images/Logs geschrieben.

## Edge Cases

### Fall 1

- Gegeben: Ein frisches persistentes Volume ohne Cloud-Credentials
- Wenn: das host-only-Profil gestartet und neu gestartet wird
- Dann: Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.
- Quelle: `docker-compose.yml`, `.github/workflows/verify.yml`

### Fall 2

- Gegeben: Host+AI oder Host+Media mit fehlenden optionalen Credentials
- Wenn: das jeweilige Profil startet
- Dann: Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.
- Quelle: `docker-compose.yml`, `.github/workflows/verify.yml`

### Fall 3

- Gegeben: Derselbe Fixture-Stand im nativen Host und im Container
- Wenn: die Integrationssuite beide Varianten prüft
- Dann: HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.
- Quelle: `docker-compose.yml`, `.github/workflows/verify.yml`

## Acceptance

- [ ] Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.
- [ ] Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.
- [ ] HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #793 (MIG-014)
- Depends on #794 (MIG-015)
- Depends on #841 (MIG-500)
- Depends on #830 (MIG-414)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-601`
- Design: `.qa/design/migration-issues/stack-migration-mig-601.md`
- Status: blocked
- Reihenfolge: 83; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-083`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-601.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
