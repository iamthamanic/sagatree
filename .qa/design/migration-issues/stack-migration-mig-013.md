<!-- migration-contract:v2 localId=MIG-013 -->
# MIG-013: SagaTree Policy Service core (deny-by-default)

## Type

feature

## Intent

RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen des permissions-Moduls mit deny-by-default abbilden.

## Goal

RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen des permissions-Moduls mit deny-by-default abbilden. Zielpfade: server/src/modules/permissions, server/src/permissions.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`.
- Source Contracts: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/modules/permissions`
- `server/src/permissions`

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

- Identität, Welt-Owner, Projekt-GM und aktive Membership werden unabhängig geprüft. Legacy-Berechtigungsdefekte bekommen eine explizite sichere Abweichung und keinen Paritätsbonus. permissions ist der einzige Policy-Einstieg für Host-Mutationen.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: O besitzt eine Welt, G verwaltet ein Projekt dieser Welt und P1/P2 sind Mitglieder
- Wenn: die Policy-Matrix Weltbearbeitung, Session-GM und Spielerlesen prüft
- Dann: Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 2

- Gegeben: Unbekannte Operation, fehlender Actor, inaktive Membership und fremder Tenant
- Wenn: jeder Fall denselben zentralen Policy-Einstieg aufruft
- Dann: Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 3

- Gegeben: HTTP, WebSocket, Job-Worker und interner Adapter
- Wenn: sie eine geschützte Anwendungsmutation aufrufen
- Dann: Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

### Fall 4

- Gegeben: Ein Domänenmodul oder Use-Case
- Wenn: eine geschützte Mutation ausführt
- Dann: Der Aufruf geht über modules/permissions public API; ORM-/SQL-Bypässe in persistence bleiben zusätzliche High-Findings bis Import-Boundary-CI greift und ersetzen keine Modul-Boundary-Prüfung.
- Quelle: `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations`, `docs/ops/negative-authz-suite.md`, `docs/architecture/host-modular-monolith.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.
2. Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.
3. Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.
4. Der Aufruf geht über modules/permissions public API; ORM-/SQL-Bypässe in persistence bleiben zusätzliche High-Findings bis Import-Boundary-CI greift und ersetzen keine Modul-Boundary-Prüfung.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.
- [ ] Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.
- [ ] Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.
- [ ] Der Aufruf geht über modules/permissions public API; ORM-/SQL-Bypässe in persistence bleiben zusätzliche High-Findings bis Import-Boundary-CI greift und ersetzen keine Modul-Boundary-Prüfung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/modules/permissions`, `server/src/permissions` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-600/#845 policy parity suite |
| **FEATURE VERIFIED** | MIG-600/#845 + MIG-602/#847 (+ MIG-311/#810 for legacy adapters) |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #790 (MIG-011)
- Depends on #784 (GATE-01)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-013`
- Design: `.qa/design/migration-issues/stack-migration-mig-013.md`
- Status: done
- Reihenfolge: 10; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-010`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-013.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

