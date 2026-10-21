# RPC-Vertrag: `join_session_by_code`

Tritt einer nicht abgeschlossenen Session bei und stellt Projektmitgliedschaft und Roster her.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#869](https://github.com/iamthamanic/sagatree/issues/869) — RPC-SESSION-ACCESS; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Code wird getrimmt und großgeschrieben; die gefundene Session wird gesperrt, completed wird abgewiesen.
- ensure_active_project_player stellt die aktive Projektmitgliedschaft her. Roster-UPSERT setzt optionalen Charakter und online, danach folgen Revision und join-Event.
- Antwort ist die aktuelle vollständige sessions-Zeile; Beitritt ist kein Snapshot-RPC.

## Berechtigungen

- Authentifizierung, nicht leerer Join-Code; optionaler Charakter muss dem Akteur gehören und vollständig erstellt sein.

## SQL-Signatur 1

`public.join_session_by_code(text,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_code | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_character_id | `uuid` | DEFAULT | `NULL` |

**RETURNS:** `public.sessions`.

**Wirksame Definition:** [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) (Zeilen 405–457, SHA-256 `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/join_session_by_code-1.sql](effective-sql/join_session_by_code-1.sql); SHA-256 `ecebdd88c046db43f02ab0f30053adc51e5d98d4319c25094034d8477cdc82e9`.

### Vollständige Row-Antwort

Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.

| Spalte | Typ | NOT NULL | Default |
| --- | --- | --- | --- |
| id | `uuid` | True | `gen_random_uuid()` |
| project_id | `uuid` | False | Kein Default |
| session_number | `integer` | True | Kein Default |
| name | `character varying(255)` | False | Kein Default |
| description | `text` | False | Kein Default |
| status | `character varying(20)` | False | `'scheduled'::character varying` |
| started_at | `timestamp with time zone` | False | Kein Default |
| ended_at | `timestamp with time zone` | False | Kein Default |
| notes | `text` | False | Kein Default |
| world_state | `jsonb` | False | `'{}'::jsonb` |
| created_at | `timestamp with time zone` | False | `now()` |
| updated_at | `timestamp with time zone` | False | `now()` |
| public_id | `text` | True | Kein Default |
| code | `text` | False | Kein Default |
| runtime_revision | `bigint` | True | `0` |
| look_profile_id | `text` | False | Kein Default |

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | `SET search_path TO 'public', 'pg_temp'` |
| Migration-/Skript-EXECUTE-Deklarationen | authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.

| Owner | Effektive Fixture-ACL | authenticated EXECUTE | anon EXECUTE |
| --- | --- | --- | --- |
| postgres | `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | True |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 44 | unbedingt | `v_session` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `characterId`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | Session code is required | — | NULLIF(BTRIM(p_code), '') IS NULL |
| P0002 | Session not found | — | NOT FOUND |
| 22023 | Session is completed | — | v_session.status = 'completed' |
| 42501 | Character is not owned by the current user | — | p_character_id IS NOT NULL ∧ NOT FOUND |
| 22023 | Unvollständige Charakterbögen können keiner Session beitreten | — | p_character_id IS NOT NULL ∧ COALESCE(v_sheet_status, 'complete') <> 'complete' |

## Transaktion, Idempotenz und Folgewirkungen

- Session-Lock, Mitgliedschafts-Helper, Roster-UPSERT, Revision und Event sind eine Transaktion; kein Request-Key.

**Direkt referenzierte reale Relationen:** `public.characters`, `public.session_players`, `public.sessions`.

**Transitive reale Relationen:** `public.characters`, `public.npc_creature_controller_assignments`, `public.npc_creature_instances`, `public.project_members`, `public.session_events`, `public.session_players`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | INSERT | `public.session_events` | session_id, kind, actor_user_id, payload, revision_after, idempotency_key | unbedingt |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | ELSE AFTER: TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' ∧ TG_OP = 'DELETE' AND OLD.status = 'active' |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | UPDATE | `public.npc_creature_instances` | runtime, updated_at | unbedingt |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | UPDATE | `public.project_members` | status, character_id | FOUND ∧ v_status IS DISTINCT FROM 'active' |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | UPDATE | `public.project_members` | character_id | FOUND ∧ ELSE AFTER: v_status IS DISTINCT FROM 'active' ∧ p_character_id IS NOT NULL |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | INSERT | `public.project_members` | project_id, user_id, character_id, role, status | unbedingt |
| `public.join_session_by_code(text,uuid)` | INSERT | `public.session_players` | session_id, user_id, character_id, is_online | unbedingt |
| `public.join_session_by_code(text,uuid)` | UPDATE | `public.sessions` | runtime_revision, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.join_session_by_code(text,uuid)` | `public.sessions` / `update_sessions_updated_at` | `public.update_updated_at_column()` |
| `public.join_session_by_code(text,uuid)` | `public.sessions` / `trg_sessions_forbid_public_id_change` | `public.forbid_public_id_change()` |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | `public.project_members` / `trg_clear_npc_creature_controller_on_member_inactive` | `public.clear_npc_creature_controller_on_member_inactive()` |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | `public.project_members` / `trg_clear_npc_creature_instance_temp_controller_on_member_inact` | `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | `public.npc_creature_instances` / `trg_npc_creature_instances_updated_at` | `public.set_npc_creature_instances_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.append_session_event(uuid,text,uuid,jsonb,bigint,text)` | [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | Keine eigene RAISE | True/True |
| `public.clear_npc_creature_controller_on_member_inactive()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.ensure_active_project_player(uuid,uuid,uuid)` | [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | Keine eigene RAISE | True/True |
| `public.forbid_public_id_change()` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.set_npc_creature_controller_assignments_updated_at()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.set_npc_creature_instances_updated_at()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.update_updated_at_column()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:180

AST-Auflösung: `string-literal`; SHA-256 `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async joinSession(payload: JoinSessionDto): Promise<SessionVm> {
    await this.requireAuthUser();

    const code = normalizeSessionJoinCode(payload.code);

    const { data, error } = await supabase.rpc('join_session_by_code', {
      p_code: code,
      p_character_id: payload.character_id ?? null,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Session nicht gefunden');
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(dto.id);
    return this.mapToViewModel(dto, players);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 7 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `normalizeSessionJoinCode` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 39 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `JoinSessionDto` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 43 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 48 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionPlayerVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 64 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionRow` | [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | 41 | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Kleingeschriebener/umgebener gültiger Code führt zur korrekten Session und aktiven Projekt-/Roster-Zuordnung.
- [ ] Fremder oder unvollständiger Charakter wird abgewiesen und erzeugt weder Mitgliedschaft noch Roster/Event.
- [ ] Abgeschlossene Session und unbekannter Code folgen den expliziten SQLSTATE-Pfaden ohne Teilbeitritt.
- [ ] Wiederholter Beitritt dupliziert keine Roster-/Mitgliedszeile, erzeugt aber den belegten zusätzlichen Revisions-/Join-Event-Schritt.
- [ ] Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Critical — RPC-SEC-ANON-EVENT-HELPER

Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.

**Beleg:** supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.

**Erforderliche Nachfolger-Abnahme:** Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-EVENT-HELPER-ANON`. Eigene RPC-Reproduktion: True.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | `cc020b1d34e84b53bfd26fd2256963d3f2602eabfe369672b67c01b865966da8` |
| [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008` |
| [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/047_session_program_presentation.sql](../../../supabase/migrations/047_session_program_presentation.sql) | `98fd05e6d1ae794db77b46eb910fadacffdc760246cda412404c1246eaf0110e` |
| [supabase/migrations/048_session_knowledge_reveals.sql](../../../supabase/migrations/048_session_knowledge_reveals.sql) | `d2cc67aea9ea3751ca52d09392c0777529019e4700b80a63fdbbd4dc4fcec8b7` |
| [supabase/migrations/051_session_director_runtime.sql](../../../supabase/migrations/051_session_director_runtime.sql) | `7b483670555f06c5dec8dd3347e9b8b9336c17b143a6ada8f0c90709b479c010` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
