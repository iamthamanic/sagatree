# RPC-Vertrag: `duplicate_saga_playthrough`

Dupliziert als GM eine Spielgruppe im Modus fresh oder with_progress.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#873](https://github.com/iamthamanic/sagatree/issues/873) — RPC-SAGA-PROVISION; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- fresh nimmt initialAdventure aus der gebundenen Version, with_progress übernimmt den bestehenden Projektfortschritt.
- Neue Projekt-/Public-ID, Join-Code und GM-Mitgliedschaft; Antwort ist TABLE(id uuid, public_id text), also tabellarische Menge mit einer Erfolgszeile.
- Quell-Sessions, Session-Identitäten und andere Projektmitgliedschaften werden nicht kopiert.

## Berechtigungen

- Authentifizierter GM des Quellprojekts; vorhandene Saga-/Versionsbindung und gültiger Modus erforderlich.

## SQL-Signatur 1

`public.duplicate_saga_playthrough(uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_mode | `text` | DEFAULT | `'fresh'` |
| id | `uuid` | TABLE | Kein Default — expliziter Wert erforderlich |
| public_id | `text` | TABLE | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `SETOF pg_catalog.record`.

**Wirksame Definition:** [supabase/migrations/082_duplicate_saga_playthrough.sql](../../../supabase/migrations/082_duplicate_saga_playthrough.sql) (Zeilen 5–95, SHA-256 `fcab51b99d8c672e0d77372a037446602613905e44634e8dd788bf76c7e79f28`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/duplicate_saga_playthrough-1.sql](effective-sql/duplicate_saga_playthrough-1.sql); SHA-256 `87c770acd851b447d677b0970170fb90ac7d48922f35831cc4f777dd3e3dd9d8`.

### TABLE-Antwort

| Ausgabespalte | Typ |
| --- | --- |
| id | `uuid` |
| public_id | `text` |

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
| 80 | unbedingt | `SELECT created.id, created.public_id` |
| 10 | unbedingt | `RETURN datum/void` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | actor IS NULL |
| 22023 | Ungültiger Duplikat-Modus | — | v_mode NOT IN ('fresh', 'with_progress') |
| P0002 | Saga nicht gefunden | — | NOT FOUND |
| 42501 | Nur der Gamemaster kann duplizieren | — | src.gm_user_id IS DISTINCT FROM actor |
| 22023 | Diese Saga hat keine Fassung | — | src.saga_id IS NULL OR src.saga_version_id IS NULL |
| P0002 | Fassung nicht gefunden | — | NOT FOUND |

## Transaktion, Idempotenz und Folgewirkungen

- Projektkopie und Mitgliedschaft sind eine Transaktion; Wiederholung erzeugt unabhängige Kopien.

**Direkt referenzierte reale Relationen:** `public.project_members`, `public.projects`, `public.saga_definition_versions`.

**Transitive reale Relationen:** `public.look_profiles`, `public.npc_creature_controller_assignments`, `public.npc_creature_instances`, `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' |
| `public.clear_npc_creature_controller_on_member_inactive()` | UPDATE | `public.npc_creature_controller_assignments` | controller_user_id, updated_at | ELSE AFTER: TG_OP = 'UPDATE'      AND OLD.status = 'active'      AND NEW.status IS DISTINCT FROM 'active' ∧ TG_OP = 'DELETE' AND OLD.status = 'active' |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | UPDATE | `public.npc_creature_instances` | runtime, updated_at | unbedingt |
| `public.duplicate_saga_playthrough(uuid,text)` | INSERT | `public.projects` | code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime | unbedingt |
| `public.duplicate_saga_playthrough(uuid,text)` | INSERT | `public.project_members` | project_id, user_id, role, status | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.projects` / `generate_project_code_trigger` | `public.generate_project_code()` |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.projects` / `trg_projects_world_profile_binding` | `public.enforce_world_profile_binding_ownership()` |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.projects` / `trg_projects_ensure_public_id` | `public.ensure_public_id()` |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.projects` / `trg_projects_default_look_binding` | `public.enforce_default_look_profile_binding()` |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.project_members` / `trg_clear_npc_creature_controller_on_member_inactive` | `public.clear_npc_creature_controller_on_member_inactive()` |
| `public.duplicate_saga_playthrough(uuid,text)` | `public.project_members` / `trg_clear_npc_creature_instance_temp_controller_on_member_inact` | `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | `public.npc_creature_instances` / `trg_npc_creature_instances_updated_at` | `public.set_npc_creature_instances_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |
| `public.clear_npc_creature_controller_on_member_inactive()` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.clear_npc_creature_controller_on_member_inactive()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.clear_npc_creature_instance_temp_controller_on_member_inactive()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.enforce_default_look_profile_binding()` | [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | P0001 | True/True |
| `public.enforce_world_profile_binding_ownership()` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | P0001 | True/True |
| `public.ensure_public_id()` | [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | Keine eigene RAISE | True/True |
| `public.generate_project_code()` | [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | Keine eigene RAISE | True/True |
| `public.generate_sagatree_public_id(text)` | [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | P0001 | True/True |
| `public.set_npc_creature_controller_assignments_updated_at()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |
| `public.set_npc_creature_instances_updated_at()` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/saga/saga-definition-service.ts:191

AST-Auflösung: `string-literal`; SHA-256 `f822494e28a12fb507a934430baeed0e77e8b60ed1f84e17eca2e3f68e6ed6a4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async duplicatePlaythrough(input: {
    readonly projectId: string;
    readonly mode: 'fresh' | 'with_progress';
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('duplicate_saga_playthrough', {
        p_project_id: input.projectId,
        p_mode: input.mode,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Duplizieren Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga konnte nicht dupliziert werden');
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      throw new Error('Ungültige Duplikat-Antwort');
    }
    const parsed = row as { id?: string; public_id?: string };
    if (typeof parsed.id !== 'string') {
      throw new Error('Duplikat ohne ID');
    }
    return {
      id: parsed.id,
      publicId: typeof parsed.public_id === 'string' ? parsed.public_id : '',
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

- [ ] fresh vs with_progress mit abweichendem Initial-/Laufzeitfortschritt unterscheiden und exakt vergleichen.
- [ ] Beide Modi erzeugen neue UUID/Public-ID und genau eine neue aktive GM-Mitgliedschaft.
- [ ] Nicht-GM, fehlende Saga-Bindung und ungültiger Modus scheitern ohne Kopie.
- [ ] Client extrahiert die erste TABLE-Zeile und behandelt leere/unvollständige RPC-Antwort als Fehler.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Entfernte historische Signaturen

| Entfernte Signatur | Grund | Quelle |
| --- | --- | --- |
| `public.duplicate_saga_playthrough(uuid,text)` | explicit DROP FUNCTION | [supabase/migrations/082_duplicate_saga_playthrough.sql](../../../supabase/migrations/082_duplicate_saga_playthrough.sql) (Zeilen 1–5, SHA-256 `fcab51b99d8c672e0d77372a037446602613905e44634e8dd788bf76c7e79f28`) |

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
| [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | `cc020b1d34e84b53bfd26fd2256963d3f2602eabfe369672b67c01b865966da8` |
| [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/046_look_profiles.sql](../../../supabase/migrations/046_look_profiles.sql) | `fd88d270538c2e6839540de7a8542e63410463ea1b081a670850134c2979aa2d` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/082_duplicate_saga_playthrough.sql](../../../supabase/migrations/082_duplicate_saga_playthrough.sql) | `fcab51b99d8c672e0d77372a037446602613905e44634e8dd788bf76c7e79f28` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/084_look_profiles_public_id.sql](../../../supabase/migrations/084_look_profiles_public_id.sql) | `1dcc8707454b4968ae783f102ae45aeb2300ee8ebb5e25e3559c003d5802b396` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
