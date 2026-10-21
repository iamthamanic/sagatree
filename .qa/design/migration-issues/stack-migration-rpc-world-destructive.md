<!-- migration-contract:v2 localId=RPC-WORLD-DESTRUCTIVE -->
# RPC-WORLD-DESTRUCTIVE: Folgenvorschau, Archivierung und Löschung

## Type

Task

## Intent

Folgenvorschau, Archivierung und Löschung: preview_world_node_consequences, archive_world_node_subtree, delete_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Folgenvorschau, Archivierung und Löschung: preview_world_node_consequences, archive_world_node_subtree, delete_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-destructive/preview_world_node_consequences/index.ts, server/src/application/world-destructive/archive_world_node_subtree/index.ts, server/src/application/world-destructive/delete_world_node/index.ts, server/src/modules/world/index.ts, server/src/application/commands/preview_world_node_consequences.ts, server/src/application/commands/archive_world_node_subtree.ts, server/src/application/commands/delete_world_node.ts, server/src/application/world-destructive/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #813. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/world/world-place-service.ts, src/lib/authenticatedUser.ts, src/lib/networkTimeout.ts, src/lib/supabase.ts, supabase/migrations/008_world_profiles.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/019_world_profiles_read_for_adventure.sql, supabase/migrations/075_saga_permission_grants.sql, supabase/migrations/083_world_profiles_public_id.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/095_donalu_world_places.sql, supabase/migrations/101_world_places_select_editor_only.sql, supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql, supabase/migrations/104_atlas_worldbuilder_mutations.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/preview_world_node_consequences.md, .qa/intake/rpc-contracts/archive_world_node_subtree.md, .qa/intake/rpc-contracts/delete_world_node.md.

### Nachher und Verhalten

Folgenvorschau, Archivierung und Löschung: preview_world_node_consequences, archive_world_node_subtree, delete_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-destructive/preview_world_node_consequences/index.ts, server/src/application/world-destructive/archive_world_node_subtree/index.ts, server/src/application/world-destructive/delete_world_node/index.ts, server/src/modules/world/index.ts, server/src/application/commands/preview_world_node_consequences.ts, server/src/application/commands/archive_world_node_subtree.ts, server/src/application/commands/delete_world_node.ts, server/src/application/world-destructive/__tests__.

## Scope

- Quellpfade: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`
- Änderbare Zielpfade: `server/src/application/world-destructive/preview_world_node_consequences/index.ts`, `server/src/application/world-destructive/archive_world_node_subtree/index.ts`, `server/src/application/world-destructive/delete_world_node/index.ts`, `server/src/modules/world/index.ts`, `server/src/application/commands/preview_world_node_consequences.ts`, `server/src/application/commands/archive_world_node_subtree.ts`, `server/src/application/commands/delete_world_node.ts`, `server/src/application/world-destructive/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/preview_world_node_consequences.md`, `.qa/intake/rpc-contracts/archive_world_node_subtree.md`, `.qa/intake/rpc-contracts/delete_world_node.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

### Bekannte Legacy-Defekte / offene Verifikation

- {"id":"RPC-DATA-SHARED-MAP-DELETE","severity":"Medium","status":"blocked-successor-acceptance","summary":"Die Kartenlöschung umfasst jede Karte eines Teilbaumlinks, auch bei weiteren Links außerhalb des Teilbaums.","sourceEvidence":"supabase/migrations/104_atlas_worldbuilder_mutations.sql: delete_world_node sammelt map_id ohne Exklusivitätsbedingung und löscht gesammelte Nicht-world-Karten.","requiredSuccessorAcceptance":"Gemeinsam genutzte Karten/FK-Cascades mit Außenort-Fixture prüfen und eine explizite Erhaltungs- oder Bestätigungsregel festlegen; keine unbemerkte Datenverlust-Parität.","deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für preview_world_node_consequences, archive_world_node_subtree, delete_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für preview_world_node_consequences, archive_world_node_subtree, delete_world_node ausführt
- Dann: Die Vorschau zählt Nachfahren und Saga-Bindings exakt und gibt requiresConfirm für die betroffene Struktur zurück.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für preview_world_node_consequences, archive_world_node_subtree, delete_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für preview_world_node_consequences, archive_world_node_subtree, delete_world_node ausführt
- Dann: Archivierung umfasst Wurzel und Nachfahren und erhöht deren Revision; Wiederholung bleibt definiert.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für preview_world_node_consequences, archive_world_node_subtree, delete_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für preview_world_node_consequences, archive_world_node_subtree, delete_world_node ausführt
- Dann: Löschung entfernt nur den bestätigten Teilbaum mit zugehörigen Links/Karten und löst Saga-Ortsreferenzen in derselben Transaktion.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für preview_world_node_consequences, archive_world_node_subtree, delete_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für preview_world_node_consequences, archive_world_node_subtree, delete_world_node ausführt
- Dann: Fehlende Bestätigung oder fehlende Editor-Rechte verändert weder Orte, Bindings noch Karten.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

## Acceptance

- [ ] Die Vorschau zählt Nachfahren und Saga-Bindings exakt und gibt requiresConfirm für die betroffene Struktur zurück.
- [ ] Archivierung umfasst Wurzel und Nachfahren und erhöht deren Revision; Wiederholung bleibt definiert.
- [ ] Löschung entfernt nur den bestätigten Teilbaum mit zugehörigen Links/Karten und löst Saga-Ortsreferenzen in derselben Transaktion.
- [ ] Fehlende Bestätigung oder fehlende Editor-Rechte verändert weder Orte, Bindings noch Karten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #865 (RPC-WORLD-RESTRUCTURE)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-world-destructive`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-destructive.md`
- Status: blocked
- Reihenfolge: 41; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-041`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-destructive.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
