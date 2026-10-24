<!-- migration-contract:v2 localId=MIG-012 -->
# MIG-012: Repository port pattern + first world read adapter

## Type

feature

## Intent

Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen im world-Modul etablieren.

## Goal

Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen im world-Modul etablieren. Zielpfade: server/src/modules/world, server/src/repositories/world, src/infrastructure/world.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`.
- Source Contracts: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/modules/world`
- `server/src/repositories/world`
- `src/infrastructure/world`

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

- Ein Repository-Aufruf erhält einen geprüften Actor-Kontext; fehlende Owner-/Projektberechtigung wird vor der Projektion abgewiesen. world-Ownership und öffentliche Read-Ports folgen dem Host-Modulvertrag.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Bestehende Welt-Repository-Aufrufer und der neue Host-Adapter
- Wenn: dieselben autorisierten Weltabfragen ausgeführt werden
- Dann: IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.
- Quelle: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: X kennt die Welt-ID von O
- Wenn: X dieselbe Query über den Host ausführt
- Dann: Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.
- Quelle: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: Persistierte Weltänderung und ein Host-Neustart
- Wenn: der Adapter erneut liest
- Dann: Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.
- Quelle: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Ein session- oder character-Use-Case benötigt Weltdaten
- Wenn: er liest über den öffentlichen world-Read-Port
- Dann: Kein Cross-Module-Import von world/internal oder world/persistence; Joins entstehen im Use-Case über DTOs, nicht über fremde Tabellenmaps.
- Quelle: `src/infrastructure/world`, `src/domains/world`, `docs/architecture/host-modular-monolith.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.
2. Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.
3. Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.
4. Kein Cross-Module-Import von world/internal oder world/persistence; Joins entstehen im Use-Case über DTOs, nicht über fremde Tabellenmaps.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.
- [ ] Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.
- [ ] Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.
- [ ] Kein Cross-Module-Import von world/internal oder world/persistence; Joins entstehen im Use-Case über DTOs, nicht über fremde Tabellenmaps.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/modules/world`, `server/src/repositories/world`, `src/infrastructure/world` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-012`
- Design: `.qa/design/migration-issues/stack-migration-mig-012.md`
- Status: done
- Reihenfolge: 11; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-011`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-012.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

