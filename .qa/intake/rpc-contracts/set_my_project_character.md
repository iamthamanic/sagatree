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

### src/infrastructure/project/project-member-service.ts:111

AST-Auflösung: `string-literal`; SHA-256 `bc15c872ef4979b1f6c67c9dc01838e8a7ee45083f225121d688d60b442bbb26`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    if (isHostLibraryEnabled()) {
      const updated = await setHostMyProjectCharacter(projectId, characterId);
      const memberId = requireUuid(updated.memberId, 'set_my_project_character');
      const userId = requireUuid(updated.userId, 'set_my_project_character.userId');
      return {
        id: memberId,
        project_id: projectId,
        user_id: userId,
        role: 'player',
        status: 'active',
        character_id: characterId,
        joined_at: new Date().toISOString(),
      } as ProjectMemberDto;
    }
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
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `b2343081ddce2e2edd73651b0622e8b4cc6d8583d746a863dbe3343e3a98f71a` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `b2343081ddce2e2edd73651b0622e8b4cc6d8583d746a863dbe3343e3a98f71a` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `b2343081ddce2e2edd73651b0622e8b4cc6d8583d746a863dbe3343e3a98f71a` |
| `EnvLike` | [src/infrastructure/host/host-project-http.ts](../../../src/infrastructure/host/host-project-http.ts) | 12 | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| `defaultEnv` | [src/infrastructure/host/host-project-http.ts](../../../src/infrastructure/host/host-project-http.ts) | 17 | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| `hostMutateJson` | [src/infrastructure/host/host-project-http.ts](../../../src/infrastructure/host/host-project-http.ts) | 74 | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| `setHostMyProjectCharacter` | [src/infrastructure/host/host-project-http.ts](../../../src/infrastructure/host/host-project-http.ts) | 162 | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| `UUID_PATTERN` | [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | 18 | `bc15c872ef4979b1f6c67c9dc01838e8a7ee45083f225121d688d60b442bbb26` |
| `requireUuid` | [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | 20 | `bc15c872ef4979b1f6c67c9dc01838e8a7ee45083f225121d688d60b442bbb26` |
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
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `b2343081ddce2e2edd73651b0622e8b4cc6d8583d746a863dbe3343e3a98f71a` |
| [src/infrastructure/host/host-project-http.ts](../../../src/infrastructure/host/host-project-http.ts) | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| [src/infrastructure/project/project-member-service.ts](../../../src/infrastructure/project/project-member-service.ts) | `bc15c872ef4979b1f6c67c9dc01838e8a7ee45083f225121d688d60b442bbb26` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
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
