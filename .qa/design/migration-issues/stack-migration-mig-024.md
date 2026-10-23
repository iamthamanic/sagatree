<!-- migration-contract:v2 localId=MIG-024 -->
# MIG-024: Player/GM/spectator projections filter

## Type

feature

## Intent

Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen.

## Goal

Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen. Zielpfade: server/src/projections.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`.
- Source Contracts: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/projections`

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

- Verborgene NPCs, gm_only-Texte und nicht freigegebene Karten werden vor Serialization entfernt; Client-Filter gelten nicht als Berechtigung.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: GM, P1, P2 und Beobachter in derselben Sitzung mit verschiedenem Reveal-Stand
- Wenn: Snapshot und Delta derselben Revision gelesen werden
- Dann: Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.
- Quelle: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 2

- Gegeben: P1 verliert eine Freigabe oder Membership
- Wenn: er Reconnect oder ältere Revision anfordert
- Dann: Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.
- Quelle: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`

### Fall 3

- Gegeben: Ein absichtlich deaktivierter serverseitiger Secret-Filter
- Wenn: die Negativsuite läuft
- Dann: Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.
- Quelle: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.
2. Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.
3. Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.
- [ ] Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.
- [ ] Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #784 (GATE-01)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-024`
- Design: `.qa/design/migration-issues/stack-migration-mig-024.md`
- Status: ready
- Reihenfolge: 18; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-018`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-024.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

