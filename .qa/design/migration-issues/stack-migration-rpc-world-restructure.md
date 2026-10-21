<!-- migration-contract:v2 localId=RPC-WORLD-RESTRUCTURE -->
# RPC-WORLD-RESTRUCTURE: Weltknoten verschieben und duplizieren

## Type

Task

## Intent

Weltknoten verschieben und duplizieren: reparent_world_node, duplicate_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Weltknoten verschieben und duplizieren: reparent_world_node, duplicate_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/reparent_world_node.ts, server/src/application/commands/duplicate_world_node.ts.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #813. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world/world-place-service.ts, src/lib/authenticatedUser.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/095_donalu_world_places.sql, supabase/migrations/101_world_places_select_editor_only.sql, supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql, supabase/migrations/104_atlas_worldbuilder_mutations.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/reparent_world_node.md, .qa/intake/rpc-contracts/duplicate_world_node.md.

### Nachher und Verhalten

Weltknoten verschieben und duplizieren: reparent_world_node, duplicate_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/commands/reparent_world_node.ts, server/src/application/commands/duplicate_world_node.ts.

## Scope

- Quellpfade: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`
- Änderbare Zielpfade: `server/src/application/commands/reparent_world_node.ts`, `server/src/application/commands/duplicate_world_node.ts`
- Quellverträge: `.qa/intake/rpc-contracts/reparent_world_node.md`, `.qa/intake/rpc-contracts/duplicate_world_node.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für reparent_world_node, duplicate_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für reparent_world_node, duplicate_world_node ausführt
- Dann: Reparent verlangt Bestätigung, verbietet Selbst-/Nachfahrenzyklen und aktualisiert Ort und Primärkarten-Parent atomar.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für reparent_world_node, duplicate_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für reparent_world_node, duplicate_world_node ausführt
- Dann: Ungültige Hierarchiekante oder fremder Parent liefert 23514 ohne Teilverschiebung.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für reparent_world_node, duplicate_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für reparent_world_node, duplicate_world_node ausführt
- Dann: Duplizieren erzeugt neue IDs und Karten; shallow kopiert nur die Wurzel, deep die vollständige Unterstruktur.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für reparent_world_node, duplicate_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für reparent_world_node, duplicate_world_node ausführt
- Dann: Die Transaktion verwendet eine lokale Duplikat-Zuordnung; parallele Kopien teilen weder temporäre Datensätze noch neue IDs.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

## Acceptance

- [ ] Reparent verlangt Bestätigung, verbietet Selbst-/Nachfahrenzyklen und aktualisiert Ort und Primärkarten-Parent atomar.
- [ ] Ungültige Hierarchiekante oder fremder Parent liefert 23514 ohne Teilverschiebung.
- [ ] Duplizieren erzeugt neue IDs und Karten; shallow kopiert nur die Wurzel, deep die vollständige Unterstruktur.
- [ ] Die Transaktion verwendet eine lokale Duplikat-Zuordnung; parallele Kopien teilen weder temporäre Datensätze noch neue IDs.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #864 (RPC-WORLD-CREATE)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-world-restructure`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-restructure.md`
- Status: blocked
- Reihenfolge: 40; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-040`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-restructure.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
