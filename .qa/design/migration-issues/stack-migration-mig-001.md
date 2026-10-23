<!-- migration-contract:v2 localId=MIG-001 -->
# MIG-001: Evidence lock: freeze main baseline + golden fixture contract

## Type

chore

## Intent

Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten.

## Goal

Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten. Zielpfade: .qa/evidence/stack-migration-prep/baseline.md, scripts/stack-migration-db.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`.
- Source Contracts: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/baseline.md`
- `scripts/stack-migration-db`

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

- Nur eine isolierte lokale Datenbank mit synthetischen Identitäten verwenden; Produktiv-Verbindungsdaten sind kein Default. Source-Baseline, angewendete Migrationen und tatsächlich beobachtete Datenbank-ACL getrennt ausweisen.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein festgehaltener main-Commit und die unveränderten Repository-Migrationen
- Wenn: der Baseline-Lauf baut eine leere PostgreSQL-Instanz auf
- Dann: Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

### Fall 2

- Gegeben: Weltbesitzer O, eigenständiger Projekt-GM G, P1, P2 und Fremdbesitzer X
- Wenn: die Seed-Datei wird zweimal auf einer frischen Instanz ausgeführt
- Dann: Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

### Fall 3

- Gegeben: Ein Baseline-Commit und eine spätere Arbeitskopie
- Wenn: Tests werden protokolliert
- Dann: Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.
- Quelle: `AGENTS.md`, `.qa/project.yaml`, `supabase/migrations`, `scripts/apply-migrations.sh`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.
2. Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.
3. Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.
- [ ] Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.
- [ ] Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Keine Vorgänger.

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-001`
- Design: `.qa/design/migration-issues/stack-migration-mig-001.md`
- Status: waiting
- Reihenfolge: 1; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-001`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-001.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

