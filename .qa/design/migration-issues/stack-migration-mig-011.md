<!-- migration-contract:v2 localId=MIG-011 -->
# MIG-011: SQLite schema bootstrap + migration runner

## Type

feature

## Intent

Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung im Host-Persistenzmodul aufbauen.

## Goal

Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung im Host-Persistenzmodul aufbauen. Zielpfade: server/src/persistence, server/migrations, server/src/modules.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`.
- Source Contracts: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/persistence`
- `server/migrations`
- `server/src/modules`

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

- Schema-Upgrades dürfen keine Owner-/Membership-Zuordnung verlieren. Dateirechte und DB-Lock verhindern konkurrierende nicht koordinierte Upgrades. Tabellenfamilien bleiben dem owning module aus dem Host-Modulvertrag zugeordnet.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Leere Datenbank und ein freigegebener geordneter Schema-Stand
- Wenn: der Migrationsrunner zweimal startet
- Dann: Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: Ein absichtlich fehlerhafter Migrationsschritt
- Wenn: das Upgrade abbricht
- Dann: Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: Ein Datenbestand mit UUIDs, Zeitstempeln, JSON und Membership-FKs
- Wenn: der Integritätscheck läuft
- Dann: Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Zwei Domänenmodule mit getrennten Tabellenfamilien
- Wenn: Persistenzcode landet unter server/
- Dann: Jede Tabelle gehört genau einem Modul laut host-modular-monolith; fremde Module importieren keine privaten persistence-Pfade und schreiben nicht über Roh-SQL in fremde Aggregate.
- Quelle: `supabase/migrations`, `scripts/apply-migrations.sh`, `docs/architecture/host-modular-monolith.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.
2. Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.
3. Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.
4. Jede Tabelle gehört genau einem Modul laut host-modular-monolith; fremde Module importieren keine privaten persistence-Pfade und schreiben nicht über Roh-SQL in fremde Aggregate.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.
- [ ] Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.
- [ ] Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.
- [ ] Jede Tabelle gehört genau einem Modul laut host-modular-monolith; fremde Module importieren keine privaten persistence-Pfade und schreiben nicht über Roh-SQL in fremde Aggregate.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/persistence`, `server/migrations`, `server/src/modules` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-503/#844 + MIG-602/#847 |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 (+ MIG-311/#810 for legacy adapters) |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #789 (MIG-010)
- Depends on #784 (GATE-01)
- Depends on #787 (GATE-04)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-011`
- Design: `.qa/design/migration-issues/stack-migration-mig-011.md`
- Status: done
- Reihenfolge: 9; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-009`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-011.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

