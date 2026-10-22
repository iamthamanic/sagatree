<!-- migration-contract:v2 localId=MIG-024 -->
# MIG-024: Player/GM/spectator projections filter

## Type

Task

## Intent

Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen.

## Goal

Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen. Zielpfade: server/src/projections.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/migrations/105_atlas_worldbuilder_player_projection.sql, src/infrastructure/session, src/infrastructure/world/world-atlas-service.ts. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen. Zielpfade: server/src/projections.

## Scope

- Quellpfade: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`
- Änderbare Zielpfade: `server/src/projections`
- Quellverträge: `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `src/infrastructure/session`, `src/infrastructure/world/world-atlas-service.ts`

## Security & Data

Verborgene NPCs, gm_only-Texte und nicht freigegebene Karten werden vor Serialization entfernt; Client-Filter gelten nicht als Berechtigung.

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

## Acceptance

- [ ] Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.
- [ ] Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.
- [ ] Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #784 (GATE-01)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-024`
- Design: `.qa/design/migration-issues/stack-migration-mig-024.md`
- Status: blocked
- Reihenfolge: 18; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-018`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-024.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
