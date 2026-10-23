<!-- migration-contract:v2 localId=MIG-015 -->
# MIG-015: Solo local identity without privilege transfer

## Type

feature

## Intent

Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln.

## Goal

Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln. Zielpfade: server/src/auth/solo.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`.
- Source Contracts: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/auth/solo`

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

- Loopback und Remote-Authentifizierung bleiben getrennte Vertrauensbereiche. Ein Konfigurationswechsel gewährt bestehenden Solo-Tokens keine Netzrechte.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Ein Host ohne Cloud-Zugang auf Loopback
- Wenn: derselbe lokale Datensatz nach Neustart geöffnet wird
- Dann: Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 2

- Gegeben: Ein gültiger Solo-Nachweis
- Wenn: er gegen einen Remote-Listener oder anderen Host gesendet wird
- Dann: Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

### Fall 3

- Gegeben: Ein Host wechselt von Solo zu Remote-Betrieb
- Wenn: die vorhandenen Konten weiterverwendet werden sollen
- Dann: Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.
- Quelle: `src/lib/auth-context.tsx`, `.qa/design/gates/GATE-02-better-auth-colyseus.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.
2. Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.
3. Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.
- [ ] Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.
- [ ] Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #789 (MIG-010)
- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #785 (GATE-02)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-015`
- Design: `.qa/design/migration-issues/stack-migration-mig-015.md`
- Status: ready
- Reihenfolge: 13; Welle: 1
- Labels: `P0`, `migration-wave-1-host-auth`, `migration-order-013`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-015.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

