<!-- migration-contract:v2 localId=MIG-352 -->
# MIG-352: Replace Postgres RPC cluster: saga/project RPCs

## Type

chore

## Intent

Die 21 RPCs dieses Bereichs über 6 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.

## Goal

Die 21 RPCs dieses Bereichs über 6 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/saga-authoring/create_user_saga_definition/index.ts, server/src/application/saga-authoring/copy_native_saga_definition/index.ts, server/src/application/saga-authoring/get_saga_definition_editor/index.ts, server/src/application/saga-authoring/save_saga_definition_draft/index.ts, server/src/application/saga-authoring/publish_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/create_user_saga_definition.ts, server/src/application/commands/copy_native_saga_definition.ts, server/src/application/commands/get_saga_definition_editor.ts, server/src/application/commands/save_saga_definition_draft.ts, server/src/application/commands/publish_saga_definition_version.ts, server/src/application/saga-authoring/__tests__, server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts, server/src/application/saga-version-read/get_saga_definition_version/index.ts, server/src/application/commands/get_native_saga_definition_by_slug.ts, server/src/application/commands/get_saga_definition_version.ts, server/src/application/saga-version-read/__tests__, server/src/application/saga-provision/create_project_from_saga_version/index.ts, server/src/application/saga-provision/duplicate_saga_playthrough/index.ts, server/src/application/saga-provision/ensure_native_starter_project/index.ts, server/src/modules/project/index.ts, server/src/application/commands/create_project_from_saga_version.ts, server/src/application/commands/duplicate_saga_playthrough.ts, server/src/application/commands/ensure_native_starter_project.ts, server/src/application/saga-provision/__tests__, server/src/application/project-membership/join_project_by_code/index.ts, server/src/application/project-membership/set_my_project_character/index.ts, server/src/application/commands/join_project_by_code.ts, server/src/application/commands/set_my_project_character.ts, server/src/application/project-membership/__tests__, server/src/application/saga-governance/get_my_saga_permissions/index.ts, server/src/application/saga-governance/list_saga_bindings/index.ts, server/src/application/saga-governance/list_saga_member_permission_state/index.ts, server/src/application/saga-governance/set_saga_member_bundle/index.ts, server/src/application/saga-governance/set_saga_binding_reveal/index.ts, server/src/modules/permissions/index.ts, server/src/application/commands/get_my_saga_permissions.ts, server/src/application/commands/list_saga_bindings.ts, server/src/application/commands/list_saga_member_permission_state.ts, server/src/application/commands/set_saga_member_bundle.ts, server/src/application/commands/set_saga_binding_reveal.ts, server/src/application/saga-governance/__tests__, server/src/application/saga-projections/get_saga_overview/index.ts, server/src/application/saga-projections/get_saga_lore_timeline/index.ts, server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts, server/src/application/saga-projections/promote_session_outcome_to_world/index.ts, server/src/application/commands/get_saga_overview.ts, server/src/application/commands/get_saga_lore_timeline.ts, server/src/application/commands/promote_session_outcome_to_saga.ts, server/src/application/commands/promote_session_outcome_to_world.ts, server/src/application/saga-projections/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `src/infrastructure/project/project-service.ts`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/022_npc_creature_controller_assignments.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/046_look_profiles.sql`, `supabase/migrations/067_ensure_native_starter_project.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/076_dornhain_full_catalog_seed.sql`, `supabase/migrations/077_dornhain_default_all_accounts.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/082_dornhain_pregen_full_sheets.sql`, `supabase/migrations/082_duplicate_saga_playthrough.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/084_look_profiles_public_id.sql`, `supabase/migrations/088_gm_earthspirit_presence_character.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/090_dornhain_basic_world_map.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/098_dornhain_unified_atlas_starter.sql`, `supabase/migrations/099_dornhain_unified_world_map_v2.sql`, `supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `src/domains/project/contracts/project.types.ts`, `src/infrastructure/project/project-member-service.ts`, `supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql`, `src/infrastructure/project/saga-permission-service.ts`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `src/domains/project/contracts/saga-overview.ts`, `src/domains/saga/permissions/lore-timeline.ts`, `src/domains/session/contracts/session-outcome-promotion.ts`, `src/infrastructure/project/saga-overview-service.ts`, `src/infrastructure/saga/session-outcome-promotion-service.ts`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/060_saga_overview.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/062_session_recap_ai_summary.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/069_party_location_overview.sql`, `supabase/migrations/070_saga_promote_session_outcomes.sql`, `supabase/migrations/091_saga_overview_world_profile_id.sql`, `supabase/migrations/093_fix_saga_overview_shared_adventure.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/create_user_saga_definition.md`, `.qa/intake/rpc-contracts/copy_native_saga_definition.md`, `.qa/intake/rpc-contracts/get_saga_definition_editor.md`, `.qa/intake/rpc-contracts/save_saga_definition_draft.md`, `.qa/intake/rpc-contracts/publish_saga_definition_version.md`, `.qa/intake/rpc-contracts/get_native_saga_definition_by_slug.md`, `.qa/intake/rpc-contracts/get_saga_definition_version.md`, `.qa/intake/rpc-contracts/create_project_from_saga_version.md`, `.qa/intake/rpc-contracts/duplicate_saga_playthrough.md`, `.qa/intake/rpc-contracts/ensure_native_starter_project.md`, `.qa/intake/rpc-contracts/join_project_by_code.md`, `.qa/intake/rpc-contracts/set_my_project_character.md`, `.qa/intake/rpc-contracts/get_my_saga_permissions.md`, `.qa/intake/rpc-contracts/list_saga_bindings.md`, `.qa/intake/rpc-contracts/list_saga_member_permission_state.md`, `.qa/intake/rpc-contracts/set_saga_member_bundle.md`, `.qa/intake/rpc-contracts/set_saga_binding_reveal.md`, `.qa/intake/rpc-contracts/get_saga_overview.md`, `.qa/intake/rpc-contracts/get_saga_lore_timeline.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_saga.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_world.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/saga-authoring/create_user_saga_definition/index.ts`
- `server/src/application/saga-authoring/copy_native_saga_definition/index.ts`
- `server/src/application/saga-authoring/get_saga_definition_editor/index.ts`
- `server/src/application/saga-authoring/save_saga_definition_draft/index.ts`
- `server/src/application/saga-authoring/publish_saga_definition_version/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/create_user_saga_definition.ts`
- `server/src/application/commands/copy_native_saga_definition.ts`
- `server/src/application/commands/get_saga_definition_editor.ts`
- `server/src/application/commands/save_saga_definition_draft.ts`
- `server/src/application/commands/publish_saga_definition_version.ts`
- `server/src/application/saga-authoring/__tests__`
- `server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts`
- `server/src/application/saga-version-read/get_saga_definition_version/index.ts`
- `server/src/application/commands/get_native_saga_definition_by_slug.ts`
- `server/src/application/commands/get_saga_definition_version.ts`
- `server/src/application/saga-version-read/__tests__`
- `server/src/application/saga-provision/create_project_from_saga_version/index.ts`
- `server/src/application/saga-provision/duplicate_saga_playthrough/index.ts`
- `server/src/application/saga-provision/ensure_native_starter_project/index.ts`
- `server/src/modules/project/index.ts`
- `server/src/application/commands/create_project_from_saga_version.ts`
- `server/src/application/commands/duplicate_saga_playthrough.ts`
- `server/src/application/commands/ensure_native_starter_project.ts`
- `server/src/application/saga-provision/__tests__`
- `server/src/application/project-membership/join_project_by_code/index.ts`
- `server/src/application/project-membership/set_my_project_character/index.ts`
- `server/src/application/commands/join_project_by_code.ts`
- `server/src/application/commands/set_my_project_character.ts`
- `server/src/application/project-membership/__tests__`
- `server/src/application/saga-governance/get_my_saga_permissions/index.ts`
- `server/src/application/saga-governance/list_saga_bindings/index.ts`
- `server/src/application/saga-governance/list_saga_member_permission_state/index.ts`
- `server/src/application/saga-governance/set_saga_member_bundle/index.ts`
- `server/src/application/saga-governance/set_saga_binding_reveal/index.ts`
- `server/src/modules/permissions/index.ts`
- `server/src/application/commands/get_my_saga_permissions.ts`
- `server/src/application/commands/list_saga_bindings.ts`
- `server/src/application/commands/list_saga_member_permission_state.ts`
- `server/src/application/commands/set_saga_member_bundle.ts`
- `server/src/application/commands/set_saga_binding_reveal.ts`
- `server/src/application/saga-governance/__tests__`
- `server/src/application/saga-projections/get_saga_overview/index.ts`
- `server/src/application/saga-projections/get_saga_lore_timeline/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts`
- `server/src/application/saga-projections/promote_session_outcome_to_world/index.ts`
- `server/src/application/commands/get_saga_overview.ts`
- `server/src/application/commands/get_saga_lore_timeline.ts`
- `server/src/application/commands/promote_session_outcome_to_saga.ts`
- `server/src/application/commands/promote_session_outcome_to_world.ts`
- `server/src/application/saga-projections/__tests__`

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

- Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Die RPC-Liste create_user_saga_definition, copy_native_saga_definition, get_saga_definition_editor, save_saga_definition_draft, publish_saga_definition_version, get_native_saga_definition_by_slug, get_saga_definition_version, create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project, join_project_by_code, set_my_project_character, get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal, get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world
- Wenn: Die implementierten Untertickets werden gegen das AST-Inventar abgeglichen
- Dann: Alle 21 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-SAGA-AUTHORING, RPC-SAGA-VERSION-READ, RPC-SAGA-PROVISION, RPC-PROJECT-MEMBERSHIP, RPC-SAGA-GOVERNANCE, RPC-SAGA-PROJECTIONS; kein RPC wird doppelt implementiert oder ausgelassen.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

### Fall 2

- Gegeben: Abgeschlossene einzelne RPC-Ports
- Wenn: Die bereichsübergreifende Alt/Neu-Suite mit echter Persistenz läuft
- Dann: Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- Quelle: `.qa/intake/rpc-contracts/create_user_saga_definition.md`, `.qa/intake/rpc-contracts/copy_native_saga_definition.md`, `.qa/intake/rpc-contracts/get_saga_definition_editor.md`, `.qa/intake/rpc-contracts/save_saga_definition_draft.md`, `.qa/intake/rpc-contracts/publish_saga_definition_version.md`, `.qa/intake/rpc-contracts/get_native_saga_definition_by_slug.md`, `.qa/intake/rpc-contracts/get_saga_definition_version.md`, `.qa/intake/rpc-contracts/create_project_from_saga_version.md`, `.qa/intake/rpc-contracts/duplicate_saga_playthrough.md`, `.qa/intake/rpc-contracts/ensure_native_starter_project.md`, `.qa/intake/rpc-contracts/join_project_by_code.md`, `.qa/intake/rpc-contracts/set_my_project_character.md`, `.qa/intake/rpc-contracts/get_my_saga_permissions.md`, `.qa/intake/rpc-contracts/list_saga_bindings.md`, `.qa/intake/rpc-contracts/list_saga_member_permission_state.md`, `.qa/intake/rpc-contracts/set_saga_member_bundle.md`, `.qa/intake/rpc-contracts/set_saga_binding_reveal.md`, `.qa/intake/rpc-contracts/get_saga_overview.md`, `.qa/intake/rpc-contracts/get_saga_lore_timeline.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_saga.md`, `.qa/intake/rpc-contracts/promote_session_outcome_to_world.md`

### Fall 3

- Gegeben: Ein offenes Unterticket oder fehlender DB-/Transportnachweis
- Wenn: Der Koordinator geschlossen werden soll
- Dann: Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Alle 21 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-SAGA-AUTHORING, RPC-SAGA-VERSION-READ, RPC-SAGA-PROVISION, RPC-PROJECT-MEMBERSHIP, RPC-SAGA-GOVERNANCE, RPC-SAGA-PROJECTIONS; kein RPC wird doppelt implementiert oder ausgelassen.
2. Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
3. Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 21 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-SAGA-AUTHORING, RPC-SAGA-VERSION-READ, RPC-SAGA-PROVISION, RPC-PROJECT-MEMBERSHIP, RPC-SAGA-GOVERNANCE, RPC-SAGA-PROJECTIONS; kein RPC wird doppelt implementiert oder ausgelassen.
- [ ] Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- [ ] Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/saga-authoring/create_user_saga_definition/index.ts`, `server/src/application/saga-authoring/copy_native_saga_definition/index.ts`, `server/src/application/saga-authoring/get_saga_definition_editor/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | TBD by dependency successors: RPC-SAGA-AUTHORING/#871, RPC-SAGA-VERSION-READ/#872, RPC-SAGA-PROVISION/#873, RPC-PROJECT-MEMBERSHIP/#874, RPC-SAGA-GOVERNANCE/#875, RPC-SAGA-PROJECTIONS/#876 |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #871 (RPC-SAGA-AUTHORING)
- Depends on #872 (RPC-SAGA-VERSION-READ)
- Depends on #873 (RPC-SAGA-PROVISION)
- Depends on #874 (RPC-PROJECT-MEMBERSHIP)
- Depends on #875 (RPC-SAGA-GOVERNANCE)
- Depends on #876 (RPC-SAGA-PROJECTIONS)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-352`
- Design: `.qa/design/migration-issues/stack-migration-mig-352.md`
- Status: done
- Reihenfolge: 35; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-035`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-352.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

