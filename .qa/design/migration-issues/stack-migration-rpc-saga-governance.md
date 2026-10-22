<!-- migration-contract:v2 localId=RPC-SAGA-GOVERNANCE -->
# RPC-SAGA-GOVERNANCE: Saga-Berechtigungen, Bindings und Bundles

## Type

Task

## Intent

Saga-Berechtigungen, Bindings und Bundles: get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Berechtigungen, Bindings und Bundles: get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-governance/get_my_saga_permissions/index.ts, server/src/application/saga-governance/list_saga_bindings/index.ts, server/src/application/saga-governance/list_saga_member_permission_state/index.ts, server/src/application/saga-governance/set_saga_member_bundle/index.ts, server/src/application/saga-governance/set_saga_binding_reveal/index.ts, server/src/modules/saga/index.ts, server/src/modules/permissions/index.ts, server/src/application/commands/get_my_saga_permissions.ts, server/src/application/commands/list_saga_bindings.ts, server/src/application/commands/list_saga_member_permission_state.ts, server/src/application/commands/set_saga_member_bundle.ts, server/src/application/commands/set_saga_binding_reveal.ts, server/src/application/saga-governance/__tests__.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. Koordinator: #815. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure/project/saga-permission-service.ts, src/lib/supabase.ts, supabase/migrations/001_initial.sql, supabase/migrations/004_project_membership_security.sql, supabase/migrations/015_inventory_item_definitions.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/052_projects_look_settings.sql, supabase/migrations/059_saga_state_column_privileges.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/075_saga_permission_grants.sql, supabase/migrations/092_fix_projects_rls_recursion.sql, supabase/migrations/095_donalu_world_places.sql, supabase/migrations/096_donalu_place_map_link_rpc.sql. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/rpc-contracts/get_my_saga_permissions.md, .qa/intake/rpc-contracts/list_saga_bindings.md, .qa/intake/rpc-contracts/list_saga_member_permission_state.md, .qa/intake/rpc-contracts/set_saga_member_bundle.md, .qa/intake/rpc-contracts/set_saga_binding_reveal.md.

### Nachher und Verhalten

Saga-Berechtigungen, Bindings und Bundles: get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-governance/get_my_saga_permissions/index.ts, server/src/application/saga-governance/list_saga_bindings/index.ts, server/src/application/saga-governance/list_saga_member_permission_state/index.ts, server/src/application/saga-governance/set_saga_member_bundle/index.ts, server/src/application/saga-governance/set_saga_binding_reveal/index.ts, server/src/modules/saga/index.ts, server/src/modules/permissions/index.ts, server/src/application/commands/get_my_saga_permissions.ts, server/src/application/commands/list_saga_bindings.ts, server/src/application/commands/list_saga_member_permission_state.ts, server/src/application/commands/set_saga_member_bundle.ts, server/src/application/commands/set_saga_binding_reveal.ts, server/src/application/saga-governance/__tests__.

## Scope

- Quellpfade: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`
- Änderbare Zielpfade: `server/src/application/saga-governance/get_my_saga_permissions/index.ts`, `server/src/application/saga-governance/list_saga_bindings/index.ts`, `server/src/application/saga-governance/list_saga_member_permission_state/index.ts`, `server/src/application/saga-governance/set_saga_member_bundle/index.ts`, `server/src/application/saga-governance/set_saga_binding_reveal/index.ts`, `server/src/modules/saga/index.ts`, `server/src/modules/permissions/index.ts`, `server/src/application/commands/get_my_saga_permissions.ts`, `server/src/application/commands/list_saga_bindings.ts`, `server/src/application/commands/list_saga_member_permission_state.ts`, `server/src/application/commands/set_saga_member_bundle.ts`, `server/src/application/commands/set_saga_binding_reveal.ts`, `server/src/application/saga-governance/__tests__`
- Quellverträge: `.qa/intake/rpc-contracts/get_my_saga_permissions.md`, `.qa/intake/rpc-contracts/list_saga_bindings.md`, `.qa/intake/rpc-contracts/list_saga_member_permission_state.md`, `.qa/intake/rpc-contracts/set_saga_member_bundle.md`, `.qa/intake/rpc-contracts/set_saga_binding_reveal.md`

## Security & Data

Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

## Acceptance

- [ ] GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- [ ] Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- [ ] Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- [ ] Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #874 (RPC-PROJECT-MEMBERSHIP)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-rpc-saga-governance`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-governance.md`
- Status: blocked
- Reihenfolge: 26; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-026`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-governance.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
