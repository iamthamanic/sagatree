# RPC-Vertrag: `set_my_project_character`

Ändert oder entfernt den Charakter der eigenen aktiven Projektmitgliedschaft.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#874](https://github.com/iamthamanic/sagatree/issues/874) — RPC-PROJECT-MEMBERSHIP; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- NULL löst die Zuordnung; Nicht-NULL setzt character_id nach Validierung.
- Antwort ist die UUID der Mitgliedschaft. Keine aktive eigene Mitgliedschaft führt zu P0002.

## Berechtigungen

- Authentifizierung; nur eigene aktive project_members-Zeile. Nicht-NULL-Charakter muss eigener vollständiger Charakter sein.

## SQL-Signatur 1

`public.set_my_project_character(uuid,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_character_id | `uuid` | DEFAULT | `NULL` |

**RETURNS:** `uuid`.

**Wirksame Definition:** [supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql](../../../supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql) (Zeilen 83–133, SHA-256 `fd866217f4b6ebcd23cff6a8b346b0937ba6b3d8a472b440876c914e6154fc28`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/set_my_project_character-1.sql](effective-sql/set_my_project_character-1.sql); SHA-256 `6bd31167dcdbea34bb0afb6abfa882e02fb48b691fff1971a13644121518a8d9`.

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
| postgres | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | False |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 40 | unbedingt | `v_member_id` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | Authentication required | — | v_user_id IS NULL |
| 42501 | Character is not owned by the current user | — | p_character_id IS NOT NULL ∧ NOT FOUND |
| 22023 | Unvollständige Charakterbögen können keinem Abenteuer zugewiesen werden | — | p_character_id IS NOT NULL ∧ COALESCE(v_sheet_status, 'complete') <> 'complete' |
| P0002 | Active project membership not found | — | v_member_id IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Ein scoped Mitgliedschafts-Update; Wiederholung derselben Zuordnung erzeugt keine neue Mitgliedschaft.

**Direkt referenzierte reale Relationen:** `public.characters`, `public.project_members`.

**Transitive reale Relationen:** `public.characters`, `public.project_members`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.set_my_project_character(uuid,uuid)` | UPDATE | `public.project_members` | character_id | unbedingt |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/project-member-service.ts:61

AST-Auflösung: `string-literal`; SHA-256 `573f8aa8d8cf55347cdac8062cc8449c9ca6a7db57ed17d1e76cc1d5dafbf054`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    const { data: memberId, error: updateError } = await supabase.rpc('set_my_project_character', {
      p_project_id: projectId,
      p_character_id: characterId,
    });

    if (updateError) throw new Error(`Charakter konnte nicht aktualisiert werden: ${updateError.message}`);
    const updatedMemberId = requireUuid(memberId, 'set_my_project_character');

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', updatedMemberId)
      .single();

    if (error) throw error;
    return data;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `ProjectMemberDto` | [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | 30 | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `UUID_PATTERN` | [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | 9 | `573f8aa8d8cf55347cdac8062cc8449c9ca6a7db57ed17d1e76cc1d5dafbf054` |
| `requireUuid` | [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | 11 | `573f8aa8d8cf55347cdac8062cc8449c9ca6a7db57ed17d1e76cc1d5dafbf054` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Eigene aktive Mitgliedschaft kann vollständigen eigenen Charakter setzen und via NULL wieder entfernen.
- [ ] Fremder/unvollständiger Charakter wird abgewiesen; vorherige Zuordnung bleibt erhalten.
- [ ] Inaktives Mitglied oder Nutzer ohne Mitgliedschaft erhält P0002.
- [ ] Projekt-ID und Mitgliedschafts-ID nicht verwechseln: Rückgabe muss exakt der geänderten project_members.id entsprechen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/project/contracts/project.types.ts](../../../src/domains/project/contracts/project.types.ts) | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | `573f8aa8d8cf55347cdac8062cc8449c9ca6a7db57ed17d1e76cc1d5dafbf054` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/002_character_trait_arrays.sql](../../../supabase/migrations/002_character_trait_arrays.sql) | `74a7f112720d2572bbb8b7d8c32e0f5f5abf932c35268a34b45dc4bfedc2a02a` |
| [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [supabase/migrations/005_character_ruleset_metadata.sql](../../../supabase/migrations/005_character_ruleset_metadata.sql) | `02874b854874e5d89ad6b697563d545f5d2b72735afe763d6927e574b2ba49ca` |
| [supabase/migrations/007_sagadrive_character_profile.sql](../../../supabase/migrations/007_sagadrive_character_profile.sql) | `c64e0659f2a2006fed326a55f4521a8be21de8dffd44d0b46bd057475b5b9dff` |
| [supabase/migrations/010_characters_v3_columns.sql](../../../supabase/migrations/010_characters_v3_columns.sql) | `b1e054d6ba6678f1974c82f5a660ab6b01e34a64f9ac0f62f00f10b42f9cfc8c` |
| [supabase/migrations/014_character_abilities_emotion_profiles.sql](../../../supabase/migrations/014_character_abilities_emotion_profiles.sql) | `e34e71c2edb5ec44dd665cbd32927c3d69fa56d2cf0bdf4bf72e5b65bbd08e87` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/016_character_inventory_v2.sql](../../../supabase/migrations/016_character_inventory_v2.sql) | `22eba40df1a0e9f4033e32a2c74a316ebafbc551d46748edba2b3e260b18778f` |
| [supabase/migrations/029_character_sheet_status.sql](../../../supabase/migrations/029_character_sheet_status.sql) | `faa2b4446d078e83ed00d5894ef297e5fb7322c65481873fc6fa85983fa5ccf8` |
| [supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql](../../../supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql) | `fd866217f4b6ebcd23cff6a8b346b0937ba6b3d8a472b440876c914e6154fc28` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
