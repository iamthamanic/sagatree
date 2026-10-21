# RPC-Vertrag: `create_project_from_saga_version`

Erzeugt eine neue Spielgruppe aus einer konkreten Published-Saga-Version.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#873](https://github.com/iamthamanic/sagatree/issues/873) — RPC-SAGA-PROVISION; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Legt eigenes GM-Projekt mit neuem Code/Public-ID und aktive GM-Mitgliedschaft an; kopiert initialAdventure wenn als Objekt vorhanden.
- Name ist getrimmter Wunschname oder Definitionstitel mit Gruppen-Suffix. Antwort ist vollständige projects-Zeile.

## Berechtigungen

- Authentifizierung, zusammenpassende Saga/Version und status=published.
- Native und origin=user sind für authentifizierte Erzeugung freigegeben; andere Ursprünge (private_backfill) verlangen Eigentum. Diese bestehende veröffentlichte-user-Freigabe darf nicht still als Owner-only umgedeutet werden.

## SQL-Signatur 1

`public.create_project_from_saga_version(uuid,uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_saga_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_version_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_name | `text` | DEFAULT | `NULL` |

**RETURNS:** `public.projects`.

**Wirksame Definition:** [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) (Zeilen 210–276, SHA-256 `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/create_project_from_saga_version-1.sql](effective-sql/create_project_from_saga_version-1.sql); SHA-256 `5920819229ca9aab336bb87d1a17fa15162db08352acfda5c421058f1d3c34a7`.

### Vollständige Row-Antwort

Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.

| Spalte | Typ | NOT NULL | Default |
| --- | --- | --- | --- |
| id | `uuid` | True | `gen_random_uuid()` |
| code | `character varying(8)` | True | Kein Default |
| name | `character varying(255)` | True | Kein Default |
| description | `text` | False | Kein Default |
| world_id | `uuid` | False | Kein Default |
| gm_user_id | `uuid` | True | Kein Default |
| status | `character varying(20)` | False | `'active'::character varying` |
| settings | `jsonb` | False | `'{}'::jsonb` |
| created_at | `timestamp with time zone` | False | `now()` |
| updated_at | `timestamp with time zone` | False | `now()` |
| world_profile_id | `uuid` | False | Kein Default |
| public_id | `text` | True | Kein Default |
| adventure_runtime | `jsonb` | True | `'{}'::jsonb` |
| default_look_profile_id | `text` | False | Kein Default |
| allow_player_character_look_override | `boolean` | True | `true` |
| saga_id | `uuid` | False | Kein Default |
| saga_version_id | `uuid` | False | Kein Default |

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
| 54 | unbedingt | `created` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | actor IS NULL |
| P0002 | Saga not found | — | NOT FOUND |
| P0002 | Fassung not found | — | NOT FOUND |
| 22023 | Nur veröffentlichte Fassungen | — | v_ver.status <> 'published' |
| 42501 | forbidden | — | v_def.origin NOT IN ('native', 'user') AND v_def.owner_user_id IS DISTINCT FROM actor ∧ v_def.owner_user_id IS DISTINCT FROM actor |

## Transaktion, Idempotenz und Folgewirkungen

- Projekt und GM-Mitgliedschaft werden atomar angelegt; Wiederholung erzeugt neue Spielgruppe.

**Direkt referenzierte reale Relationen:** `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`.

**Transitive reale Relationen:** `public.look_profiles`, `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.saga_definitions`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.create_project_from_saga_version(uuid,uuid,text)` | INSERT | `public.projects` | code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime | unbedingt |
| `public.create_project_from_saga_version(uuid,uuid,text)` | INSERT | `public.project_members` | project_id, user_id, role, status | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `generate_project_code_trigger` | `public.generate_project_code()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_ensure_public_id` | `public.ensure_public_id()` |
| `public.create_project_from_saga_version(uuid,uuid,text)` | `public.projects` / `trg_projects_default_look_binding` | `public.enforce_default_look_profile_binding()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.enforce_default_look_profile_binding()` | [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | P0001 | True/True |
| `public.enforce_world_profile_binding_ownership()` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | P0001 | True/True |
| `public.ensure_public_id()` | [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.generate_project_code()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/saga/saga-definition-service.ts:159

AST-Auflösung: `string-literal`; SHA-256 `f822494e28a12fb507a934430baeed0e77e8b60ed1f84e17eca2e3f68e6ed6a4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async createProjectFromVersion(input: {
    readonly sagaId: string;
    readonly versionId: string;
    readonly name?: string;
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('create_project_from_saga_version', {
        p_saga_id: input.sagaId,
        p_version_id: input.versionId,
        p_name: input.name ?? null,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Neue Gruppe Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Gruppe konnte nicht erstellt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Projekt-Antwort');
    }
    const row = data as { id?: string; public_id?: string };
    if (typeof row.id !== 'string') {
      throw new Error('Projekt ohne ID');
    }
    return {
      id: row.id,
      publicId: typeof row.public_id === 'string' ? row.public_id : '',
    };
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Zusammenpassende Published-Version erzeugt neue Actor-GM-Spielgruppe und aktive GM-Mitgliedschaft mit den korrekten Saga-IDs.
- [ ] Unpassende Saga/Version, Draft statt Published und fremder private_backfill werden abgewiesen ohne Projekt.
- [ ] Origin=user einer anderen Person hat den exakt dokumentierten Legacy-Zugriff; Nachfolgerzugriff muss durch explizite Produkt-/Sicherheitsentscheidung bestätigt werden.
- [ ] InitialAdventure-Objekt wird kopiert, keine alte Session/Projekt-ID; Rückgabe besteht den Row-Decoder.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Medium — RPC-POLICY-USER-PUBLISHED

Veröffentlichte User-Sagas können von anderen authentifizierten Nutzern als eigene GM-Spielgruppe instanziert werden.

**Beleg:** supabase/migrations/063_saga_definitions.sql: create_project_from_saga_version erlaubt origin IN (native,user), während get_saga_definition_version einen anderen Lesescope hat.

**Erforderliche Nachfolger-Abnahme:** Öffentlichkeits-/Lizenzregel für user-Veröffentlichungen explizit festlegen; die durch neue GM-Mitgliedschaft erweiterte Payload-Lesbarkeit im Negativ-/Positivtest abnehmen.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/saga/saga-definition-service.ts](../../../src/infrastructure/saga/saga-definition-service.ts) | `f822494e28a12fb507a934430baeed0e77e8b60ed1f84e17eca2e3f68e6ed6a4` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/064_saga_editor_v1.sql](../../../supabase/migrations/064_saga_editor_v1.sql) | `a2bc1eed25dcd62ebcf06a444a4fcef963552bada5e1b0427fedc2b01dbe4bfd` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
