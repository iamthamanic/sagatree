<!-- migration-contract:v2 localId=MIG-601 -->
# MIG-601: Docker Compose simplification for host+optional AI/media

## Type

feature

## Intent

Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen.

## Goal

Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen. Zielpfade: deployment, docs/ops.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `docker-compose.yml`, `.github/workflows/verify.yml`.
- Source Contracts: `docker-compose.yml`, `.github/workflows/verify.yml`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `deployment`
- `docs/ops`

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

- Host-only benötigt keine Cloud-Secrets; optionale Provider-Credentials werden extern injiziert und nicht in Images/Logs geschrieben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

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

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.
2. Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.
3. HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.
- [ ] Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.
- [ ] HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Reproducible host Compose profiles + runbook + native host readiness/restart + explicit AI/media capability errors (static Compose contract). |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | Live Docker-in-CI compose up/restart and native↔container HTTP/realtime/persistence parity is MIG-602/#847. |
| **FEATURE VERIFIED** | MIG-602/#847 / MIG-700/#849. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #789 (MIG-010)
- Depends on #793 (MIG-014)
- Depends on #794 (MIG-015)
- Depends on #841 (MIG-500)
- Depends on #830 (MIG-414)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-601`
- Design: `.qa/design/migration-issues/stack-migration-mig-601.md`
- Status: done
- Reihenfolge: 83; Welle: 6
- Labels: `P1`, `migration-wave-6-security-ops`, `migration-order-083`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-601.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

