<!-- migration-contract:v2 localId=MIG-500 -->
# MIG-500: Local protected asset service (replace Storage buckets)

## Type

feature

## Intent

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen.

## Goal

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen. Zielpfade: server/src/assets.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`.
- Source Contracts: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/assets`

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

- Weder Dateipfad noch URL ist ein Berechtigungsnachweis; Traversal, Symlinks und fremde Owner-Referenzen werden vor Dateizugriff abgewiesen.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein autorisierter Upload und validierte Dateibytes
- Wenn: validate→publish→metadata commit ausgeführt wird
- Dann: Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

### Fall 2

- Gegeben: X kennt eine fremde Asset-ID oder sendet ../ bzw. einen Symlinkpfad
- Wenn: Download oder Upload versucht wird
- Dann: Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

### Fall 3

- Gegeben: Abbruch nach temporärer Datei und vor Metadaten-Commit
- Wenn: Recovery und Cleanup laufen
- Dann: Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.
- Quelle: `supabase/functions/media`, `src/infrastructure/media`, `supabase/migrations`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.
2. Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.
3. Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.
- [ ] Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.
- [ ] Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/assets` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none (slice closed; feature verify via MIG-600/#845 + MIG-602/#847) |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-500`
- Design: `.qa/design/migration-issues/stack-migration-mig-500.md`
- Status: done
- Reihenfolge: 14; Welle: 1
- Labels: `P1`, `migration-wave-1-host-auth`, `migration-order-014`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-500.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

