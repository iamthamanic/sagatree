# RPC-Vertrag: `create_play_session`

Erzeugt als Projekt-GM eine unmittelbar wartende Spielsession.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#868](https://github.com/iamthamanic/sagatree/issues/868) — RPC-SESSION-LIFECYCLE; Koordinator [#814](https://github.com/iamthamanic/sagatree/issues/814).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Erzeugt Session mit status waiting, Projektbezug, getrimmtem optionalem Namen, neuem Join-Code und nächster Session-Nummer.
- allocate_next_session_number nutzt einen transaktionalen Advisory-Lock pro Projekt. Rückgabe ist die vollständige sessions-Zeile mit allen aktuellen Spalten.

## Berechtigungen

- auth.uid() erforderlich; is_project_gm(project_id, actor) muss wahr sein.

## SQL-Signatur 1

`public.create_play_session(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_name | `text` | DEFAULT | `NULL` |

**RETURNS:** `public.sessions`.

**Wirksame Definition:** [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) (Zeilen 84–98, SHA-256 `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/create_play_session-1.sql](effective-sql/create_play_session-1.sql); SHA-256 `d9cfe0173cc4ad2fb500d411750e46972e195b1fb3e6ec66504d61f703171717`.

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
| 10 | unbedingt | `created` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | actor IS NULL |
| 22023 | project_id required | — | p_project_id IS NULL |
| 42501 | forbidden | — | NOT public.is_project_gm(p_project_id, actor) |

## Transaktion, Idempotenz und Folgewirkungen

- Jeder Aufruf erzeugt eine neue Session; kein Dedup-Schlüssel. Advisory-Lock serialisiert die Nummernvergabe.

**Direkt referenzierte reale Relationen:** `public.sessions`.

**Transitive reale Relationen:** `public.look_profiles`, `public.project_members`, `public.projects`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.create_play_session(uuid,text)` | INSERT | `public.sessions` | project_id, session_number, name, status, code | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.create_play_session(uuid,text)` | `public.sessions` / `trg_sessions_ensure_public_id` | `public.ensure_public_id()` |
| `public.create_play_session(uuid,text)` | `public.sessions` / `trg_sessions_look_binding` | `public.enforce_session_look_profile_binding()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.allocate_next_session_number(uuid)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.enforce_session_look_profile_binding()` | [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | P0001 | True/True |
| `public.ensure_public_id()` | [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.generate_unique_session_code()` | [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | P0001 | True/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/session/session-service.ts:210

AST-Auflösung: `string-literal`; SHA-256 `9109e84fb2c7625aae96928d15b3c0e44ea4598cded3a9e0601d6e4031e8db2d`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async createSession(payload: CreateSessionDto): Promise<SessionVm> {
    const projectId = payload.project_id || payload.adventure_id;
    if (!projectId) {
      throw new Error('project_id ist erforderlich, um eine Session zu erstellen');
    }

    // Dual-path (MIG-311 / FE-HOST-02): host authenticates its own cookie — do not
    // require a Supabase JWT first (Better Auth cookie-only deployments).
    if (isHostLibraryEnabled()) {
      const row = await createHostPlaySession(projectId, payload.name ?? null);
      return mapHostPlaySessionToVm(row);
    }

    await this.requireAuthUser();

    const { data, error } = await supabase.rpc('create_play_session', {
      p_project_id: projectId,
      p_name: payload.name,
    });

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    return this.mapToViewModel(dto, []);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `PlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 7 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `normalizePlaySessionStatus` | [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | 17 | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `CreateSessionDto` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 36 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 48 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `SessionPlayerVm` | [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | 64 | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `41009cd3b0176f71e939383f9d227b7e31ccab685b88390c61dfd9756a8b6a99` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `41009cd3b0176f71e939383f9d227b7e31ccab685b88390c61dfd9756a8b6a99` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `41009cd3b0176f71e939383f9d227b7e31ccab685b88390c61dfd9756a8b6a99` |
| `EnvLike` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 12 | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| `defaultEnv` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 17 | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| `hostMutateJson` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 58 | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| `HostPlaySessionDto` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 98 | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| `createHostPlaySession` | [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | 150 | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| `mapHostPlaySessionToVm` | [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | 55 | `9109e84fb2c7625aae96928d15b3c0e44ea4598cded3a9e0601d6e4031e8db2d` |
| `SessionRow` | [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | 82 | `9109e84fb2c7625aae96928d15b3c0e44ea4598cded3a9e0601d6e4031e8db2d` |
| `EnvLike` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 31 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `defaultEnv` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 33 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `getHostAuthBaseUrl` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 53 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 13 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 15 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 16 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostAuthUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 17 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostFirst` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 18 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 58 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 59 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 61 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

## Konkrete Abnahmekriterien

- [ ] Projekt-GM erzeugt waiting-Session mit eindeutigem Join-Code und nächster session_number; Name wird getrimmt, leer wird NULL.
- [ ] Aktiver Player und Welt-Owner ohne Projekt-GM-Rolle erhalten 42501.
- [ ] Parallele Aufrufe für dasselbe Projekt erzeugen unterschiedliche aufeinanderfolgende Nummern und IDs.
- [ ] Decoder der Session-Infrastruktur verarbeitet die vollständige Row und ihre optionalen Zeit-/Runtime-Felder.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/session/contracts/session-lifecycle.ts](../../../src/domains/session/contracts/session-lifecycle.ts) | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| [src/domains/session/contracts/session.types.ts](../../../src/domains/session/contracts/session.types.ts) | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `41009cd3b0176f71e939383f9d227b7e31ccab685b88390c61dfd9756a8b6a99` |
| [src/infrastructure/host/host-session-http.ts](../../../src/infrastructure/host/host-session-http.ts) | `dd70c163f15af4d1ec881a9fe8cb6e87c5ccc441de2307b9b24e9a5c4b6b8172` |
| [src/infrastructure/session/session-service.ts](../../../src/infrastructure/session/session-service.ts) | `9109e84fb2c7625aae96928d15b3c0e44ea4598cded3a9e0601d6e4031e8db2d` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
