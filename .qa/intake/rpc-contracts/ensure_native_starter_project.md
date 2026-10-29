# RPC-Vertrag: `ensure_native_starter_project`

Stellt die native Starter-Spielgruppe bereit und provisioniert für Dornhain die zugehörigen Seed-Daten.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#873](https://github.com/iamthamanic/sagatree/issues/873) — RPC-SAGA-PROVISION; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Dornhain delegiert an provision_dornhain_starter_for_user mit den wirksamen späteren Seed-/World-/Binding-/Charakter-Helpern; vorhandene eigene Starter-Spielgruppe wird wiederverwendet.
- Andere native Slugs verwenden die neueste veröffentlichte Version und eine vorhandene eigene Gruppe oder create_project_from_saga_version.
- Dornhain-Antwort enthält id,public_id,created,name,saga_id,saga_version_id,world_profile_id,bindings,characters; andere Slugs haben die reduzierte Projekt-/Saga-Antwort ohne Dornhain-Anreicherungen.

## Berechtigungen

- Authentifizierter Nutzer; Slug wird normalisiert, leer verwendet dornhain.whisper.

## SQL-Signatur 1

`public.ensure_native_starter_project(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_slug | `text` | DEFAULT | `'dornhain.whisper'` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/077_dornhain_default_all_accounts.sql](../../../supabase/migrations/077_dornhain_default_all_accounts.sql) (Zeilen 530–620, SHA-256 `abfe499679448a551c28815144519c5cfc14e47211c7aaddd5b40bc1baa17e15`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/ensure_native_starter_project-1.sql](effective-sql/ensure_native_starter_project-1.sql); SHA-256 `dff8c9c15774d5634ac0f3445bef84491e8aeaa1a238a8e98d496a72f49314ff`.

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | `SET search_path TO 'public'` |
| Migration-/Skript-EXECUTE-Deklarationen | authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.

| Owner | Effektive Fixture-ACL | authenticated EXECUTE | anon EXECUTE |
| --- | --- | --- | --- |
| postgres | `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | True |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 20 | BTRIM(COALESCE(p_slug, '')) IN ('', 'dornhain.whisper') | `jsonb_build_object(       'id', v_result->>'projectId',       'public_id', v_result->>'publicId',       'created', COALESCE((v_result->>'created')::boolean, false),       'name', (SELECT name FROM public.projects WHERE id = (v_result->>'projectId')::uuid),       'saga_id', (SELECT saga_id FROM public.projects WHERE id = (v_result->>'projectId')::uuid),       'saga_version_id', (SELECT saga_version_id FROM public.projects WHERE id = (v_result->>'projectId')::uuid),       'world_profile_id', v_result->>'worldProfileId',       'bindings', (v_result->>'bindings')::int,       'characters', (v_result->>'characters')::int     )` |
| 61 | FOUND | `jsonb_build_object(       'id', existing.id,       'public_id', existing.public_id,       'created', false,       'name', existing.name,       'saga_id', v_def.id,       'saga_version_id', COALESCE(existing.saga_version_id, v_ver.id)     )` |
| 73 | unbedingt | `jsonb_build_object(     'id', created.id,     'public_id', created.public_id,     'created', true,     'name', created.name,     'saga_id', v_def.id,     'saga_version_id', v_ver.id   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `public_id`, `created`, `name`, `saga_id`, `saga_version_id`
- `id`, `public_id`, `created`, `name`, `saga_id`, `saga_version_id`, `world_profile_id`, `bindings`, `characters`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | actor IS NULL |
| P0001 | % | COALESCE(v_result->>'reason', 'provision_failed') | BTRIM(COALESCE(p_slug, '')) IN ('', 'dornhain.whisper') ∧ COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE |
| P0002 | Native Saga nicht gefunden | — | NOT FOUND |
| P0002 | Keine veröffentlichte Fassung | — | NOT FOUND |

## Transaktion, Idempotenz und Folgewirkungen

- Mehrtabellen-Provisionierung mit vorhandener-Projekt-Prüfung; konkrete Unique-Constraints/Seed-UPSERTs sind Teil des Helper-Vertrags. Gleichzeitige Erstanlagen separat testen.

**Direkt referenzierte reale Relationen:** `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `auth.users`, `public.characters`, `public.look_profiles`, `public.npc_creature_controller_assignments`, `public.npc_creature_instances`, `public.project_member_saga_bundles`, `public.project_member_saga_grants`, `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.saga_definition_versions`, `public.saga_definitions`, `public.saga_permission_bundle_keys`, `public.world_atlas_maps`, `public.world_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | ELSE AFTER: TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' ∧ TG_OP = 'DELETE' AND OLD.status = 'active' |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | UPDATE | `public.npc_creature_instances` | runtime, updated_at | unbedingt |
| `public.create_project_from_saga_version(uuid,uuid,text)` | INSERT | `public.projects` | code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime | unbedingt |
| `public.create_project_from_saga_version(uuid,uuid,text)` | INSERT | `public.project_members` | project_id, user_id, role, status | unbedingt |
| `public.ensure_member_saga_gm_bundle(uuid)` | DELETE | `public.project_member_saga_grants` | — | unbedingt |
| `public.ensure_member_saga_gm_bundle(uuid)` | INSERT | `public.project_member_saga_grants` | project_id, member_id, user_id, permission_key, source_bundle_id, granted_by | unbedingt |
| `public.ensure_member_saga_gm_bundle(uuid)` | INSERT | `public.project_member_saga_bundles` | member_id, project_id, user_id, bundle_id, assigned_by, updated_at | unbedingt |
| `public.provision_dornhain_starter_for_user(uuid)` | INSERT | `public.projects` | code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime | NOT FOUND |
| `public.provision_dornhain_starter_for_user(uuid)` | INSERT | `public.world_profiles` | owner_user_id, name, description, modules | v_project.world_profile_id IS NULL ∧ v_world IS NULL |
| `public.provision_dornhain_starter_for_user(uuid)` | UPDATE | `public.projects` | world_profile_id, updated_at | v_project.world_profile_id IS NULL |
| `public.provision_dornhain_starter_for_user(uuid)` | INSERT | `public.project_members` | project_id, user_id, role, status | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.saga_asset_bindings` | project_id, asset_kind, asset_id, reveal, label, metadata | unbedingt |
| `public.seed_dornhain_catalog_bindings(uuid)` | INSERT | `public.world_maps` | world_profile_id, revision, map_data, updated_at | v_world IS NOT NULL |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | UPDATE | `public.characters` | project_id, name, description, class, character_type, portrait_url, attributes, updated_at | v_exists |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | INSERT | `public.characters` | owner_user_id, project_id, name, description, class, race, level, ruleset_key, attributes, skills, inventory, character_type, sheet_status, portrait_url, sagatree_profile | unbedingt |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | UPDATE | `public.characters` | project_id, class, race, level, ruleset_key, attributes, skills, sagatree_profile, inventory, sheet_status, description, updated_at | v_match |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | INSERT | `public.characters` | owner_user_id, project_id, name, description, class, race, level, ruleset_key, attributes, skills, inventory, character_type, sheet_status, sagatree_profile | ELSE AFTER: v_match |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_atlas_maps` | world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta | v_root IS NULL |
| `public.seed_dornhain_unified_atlas(uuid)` | UPDATE | `public.world_atlas_maps` | title, generator_meta, updated_at | ELSE AFTER: v_root IS NULL |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_places` | world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order | unbedingt |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_places` | world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order | unbedingt |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_atlas_maps` | world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta | v_settlement IS NULL |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_place_map_links` | world_profile_id, place_id, map_id, usage, anchor | to_regclass('public.world_place_map_links') IS NOT NULL AND v_dornhain IS NOT NULL AND v_root IS NOT NULL |
| `public.seed_dornhain_unified_atlas(uuid)` | INSERT | `public.world_place_map_links` | world_profile_id, place_id, map_id, usage | to_regclass('public.world_place_map_links') IS NOT NULL AND v_dornhain IS NOT NULL AND v_root IS NOT NULL ∧ v_settlement IS NOT NULL |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `generate_project_code_trigger` | `public.generate_project_code()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `trg_projects_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `trg_projects_ensure_public_id` | `public.ensure_public_id()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `trg_projects_default_look_binding` | `public.enforce_default_look_profile_binding()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.world_profiles` / `trg_world_profiles_ensure_public_id` | `public.ensure_public_id()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `update_projects_updated_at` | `public.update_updated_at_column()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `trg_projects_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.projects` / `trg_projects_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.project_members` / `trg_clear_npc_creature_controller_on_member_inactive` | `public.clear_npc_creature_controller_on_member_inactive()` |
| `public.provision_dornhain_starter_for_user(uuid)` | `public.project_members` / `trg_clear_npc_creature_instance_temp_controller_on_member_inact` | `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | `public.npc_creature_instances` / `trg_npc_creature_instances_updated_at` | `public.set_npc_creature_instances_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `update_characters_updated_at` | `public.update_updated_at_column()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `trg_characters_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `trg_enforce_character_sheet_status_complete` | `public.enforce_character_sheet_status_complete()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `trg_characters_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `trg_characters_ensure_public_id` | `public.ensure_public_id()` |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | `public.characters` / `trg_enforce_character_sheet_status_complete` | `public.enforce_character_sheet_status_complete()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `update_characters_updated_at` | `public.update_updated_at_column()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `trg_characters_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `trg_enforce_character_sheet_status_complete` | `public.enforce_character_sheet_status_complete()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `trg_characters_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `trg_characters_ensure_public_id` | `public.ensure_public_id()` |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | `public.characters` / `trg_enforce_character_sheet_status_complete` | `public.enforce_character_sheet_status_complete()` |
| `public.seed_dornhain_unified_atlas(uuid)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |
| `public.seed_dornhain_unified_atlas(uuid)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |
| `public.seed_dornhain_unified_atlas(uuid)` | `public.world_place_map_links` / `trg_world_place_map_links_same_world` | `public.world_place_map_links_enforce_same_world()` |
| `public.seed_dornhain_unified_atlas(uuid)` | `public.world_place_map_links` / `trg_world_place_map_links_same_world` | `public.world_place_map_links_enforce_same_world()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `generate_project_code_trigger` | `public.generate_project_code()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_ensure_public_id` | `public.ensure_public_id()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_default_look_binding` | `public.enforce_default_look_profile_binding()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.build_dornhain_starter_map_data(integer)` | [supabase/migrations/090_dornhain_basic_world_map.sql](../../../supabase/migrations/090_dornhain_basic_world_map.sql) | Keine eigene RAISE | True/True |
| `public.build_dornhain_unified_generator_meta()` | [supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql](../../../supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql) | Keine eigene RAISE | True/True |
| `public.clear_npc_creature_controller_on_member_inactive()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.create_project_from_saga_version(uuid,uuid,text)` | [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | 22023, 42501, P0002 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.enforce_character_sheet_status_complete()` | [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | 22023 | True/True |
| `public.enforce_default_look_profile_binding()` | [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | P0001 | True/True |
| `public.enforce_world_profile_binding_ownership()` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | P0001 | True/True |
| `public.ensure_member_saga_gm_bundle(uuid)` | [supabase/migrations/077_dornhain_default_all_accounts.sql](../../../supabase/migrations/077_dornhain_default_all_accounts.sql) | Keine eigene RAISE | True/True |
| `public.ensure_public_id()` | [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.generate_project_code()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.provision_dornhain_starter_for_user(uuid)` | [supabase/migrations/088_gm_earthspirit_presence_character.sql](../../../supabase/migrations/088_gm_earthspirit_presence_character.sql) | 22023, P0002 | True/True |
| `public.seed_dornhain_catalog_bindings(uuid)` | [supabase/migrations/098_dornhain_unified_atlas_starter.sql](../../../supabase/migrations/098_dornhain_unified_atlas_starter.sql) | Keine eigene RAISE | True/True |
| `public.seed_dornhain_gm_presence_character(uuid,uuid)` | [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | Keine eigene RAISE | True/True |
| `public.seed_dornhain_starter_characters(uuid,uuid)` | [supabase/migrations/082_dornhain_pregen_full_sheets.sql](../../../supabase/migrations/082_dornhain_pregen_full_sheets.sql) | Keine eigene RAISE | True/True |
| `public.seed_dornhain_unified_atlas(uuid)` | [supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql](../../../supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql) | Keine eigene RAISE | True/True |
| `public.set_npc_creature_controller_assignments_updated_at()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.set_npc_creature_instances_updated_at()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.update_updated_at_column()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |
| `public.world_place_map_links_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |
| `public.world_places_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/project-service.ts:327

AST-Auflösung: `string-literal`; SHA-256 `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async ensureNativeStarterProject(slug = 'dornhain.whisper'): Promise<void> {
    const { error } = await supabase.rpc('ensure_native_starter_project', {
      p_slug: slug,
    });
    if (error) {
      console.warn('[project-service] ensure_native_starter_project:', error.message);
    }
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Erster Dornhain-Aufruf legt projektbezogene Welt, kanonische Orte/Bindings und vorgefertigte Charakterdaten entsprechend dem vollständigen Helper-Katalog an.
- [ ] Wiederholung liefert dieselbe Projekt-ID mit created=false und dupliziert keine Seed-Schlüssel/Starter-Bindings.
- [ ] Anderer nativer Slug verwendet seine neueste Published-Version; unbekannter Slug/fehlende Veröffentlichung scheitert ohne unvollständiges Projekt.
- [ ] Fremder Nutzer erhält seine eigene Gruppe/Welt; Fehler in einem Seed-/Binding-Trigger rollt die gesamte Provisionierung zurück.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/project/project-service.ts](../../../src/infrastructure/project/project-service.ts) | `b71cf1fc78c24804f4a1ebda9a001807c3dc70379b2d5cf96769081efc9a2257` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | `cc020b1d34e84b53bfd26fd2256963d3f2602eabfe369672b67c01b865966da8` |
| [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008` |
| [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/067_ensure_native_starter_project.sql](../../../supabase/migrations/067_ensure_native_starter_project.sql) | `c53b69e574c607775767513a80bf0badf52aeee31582ff2ee0887ff16039ced3` |
| [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql) | `5898195600f2fc10330b1444cb288da5d58c59b5373058fa7a5923dfb123fe43` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/076_dornhain_full_catalog_seed.sql](../../../supabase/migrations/076_dornhain_full_catalog_seed.sql) | `90378ec8d1f8d0b2d81619289609b952898a8db9bd9975d8deb9c1d007e0c418` |
| [supabase/migrations/077_dornhain_default_all_accounts.sql](../../../supabase/migrations/077_dornhain_default_all_accounts.sql) | `abfe499679448a551c28815144519c5cfc14e47211c7aaddd5b40bc1baa17e15` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/082_dornhain_pregen_full_sheets.sql](../../../supabase/migrations/082_dornhain_pregen_full_sheets.sql) | `93237176f65a3945291b5cc96cf7bd748b690fc5f8c78eeed1f00d4175cbab99` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [supabase/migrations/088_gm_earthspirit_presence_character.sql](../../../supabase/migrations/088_gm_earthspirit_presence_character.sql) | `3fe397289929cb1a16b0cfb203a93ebd3f0fba652319d684d02922cec04c2f6a` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/090_dornhain_basic_world_map.sql](../../../supabase/migrations/090_dornhain_basic_world_map.sql) | `ebcda6b58bfd7629b868cd80ac018fbc8a9f3ab8a36d4c141f1344d9b7ead741` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql) | `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/098_dornhain_unified_atlas_starter.sql](../../../supabase/migrations/098_dornhain_unified_atlas_starter.sql) | `e3da9995b29bf7491030dd9943d612bb3366f13bf7123d0efbc5ceecbc387407` |
| [supabase/migrations/099_dornhain_unified_world_map_v2.sql](../../../supabase/migrations/099_dornhain_unified_world_map_v2.sql) | `82fed4ae77a47abf9c180c71c5c690c69a85178b0c60c479cea311d4e5aae785` |
| [supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql](../../../supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql) | `6511fd19f98d221c2844cda88569ce278db562fd3e7974e61174e7b845d0e481` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql) | `a1add570f090c4b8cae03170cf5b73bc7eba6ccc2a0f785d3d1910d0a3178bb3` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
