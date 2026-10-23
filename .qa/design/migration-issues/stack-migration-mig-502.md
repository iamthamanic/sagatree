<!-- migration-contract:v2 localId=MIG-502 -->
# MIG-502: Export/import versioned bundles + restore drills

## Type

feature

## Intent

Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen.

## Goal

Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen. Zielpfade: server/src/migration/bundles.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`.
- Source Contracts: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/migration/bundles`

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

- Importpfade, Owner-Zuordnung und Referenzen werden validiert; ein fremdes Bundle darf keine existierenden fremden Daten überschreiben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein Bundle mit Karten, NPCs, Inventar, IDs und Asset-Manifest
- Wenn: Export→Import in einen leeren Fixture-Host läuft
- Dann: Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

### Fall 2

- Gegeben: Unbekannte kritische Version, Path-Traversal oder falsche Prüfsumme
- Wenn: das Bundle importiert wird
- Dann: Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

### Fall 3

- Gegeben: Ein fertig exportierter SQLite-/Asset-Stand
- Wenn: der dokumentierte Restore auf einem neuen Host ausgeführt wird
- Dann: Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.
- Quelle: `supabase/functions/export`, `src/infrastructure/world`, `src/infrastructure/saga`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.
2. Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.
3. Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.
- [ ] Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.
- [ ] Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #841 (MIG-500)
- Depends on #844 (MIG-503)
- Depends on #795 (MIG-020)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-502`
- Design: `.qa/design/migration-issues/stack-migration-mig-502.md`
- Status: ready
- Reihenfolge: 81; Welle: 5
- Labels: `P1`, `migration-wave-5-storage-export`, `migration-order-081`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-502.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

