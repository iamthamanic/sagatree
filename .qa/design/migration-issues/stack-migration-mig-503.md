<!-- migration-contract:v2 localId=MIG-503 -->
# MIG-503: Postgres→SQLite data migration dry-run tooling

## Type

feature

## Intent

Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen.

## Goal

Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen. Zielpfade: server/src/migration/postgres.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`.
- Source Contracts: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/migration/postgres`

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

- Defaults verbinden sich nur mit expliziten isolierten Testdaten. Owner, Memberships und geheime Sichtbarkeiten werden nicht vereinfacht.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein eingefrorener Postgres-Fixture-Snapshot mit vollständigem Schema
- Wenn: der Transfer auf eine leere SQLite-Datei läuft
- Dann: Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

### Fall 2

- Gegeben: Abbruch mitten im Transfer und anschließender Wiederholungslauf
- Wenn: dieselbe Snapshot-ID erneut übertragen wird
- Dann: Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

### Fall 3

- Gegeben: Synthetische Owner-/GM-/Spieler- und Secret-Daten
- Wenn: die Nachtransfer-Projektionen geprüft werden
- Dann: Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.
- Quelle: `supabase/migrations`, `.qa/intake/rpc-contracts/inventory.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.
2. Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.
3. Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.
- [ ] Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.
- [ ] Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #783 (MIG-002)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-503`
- Design: `.qa/design/migration-issues/stack-migration-mig-503.md`
- Status: waiting
- Reihenfolge: 20; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-020`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-503.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

