# RPC-Vertrag: `get_saga_overview`

Erzeugt die aktuelle Saga-Übersicht mit Episoden, Ensemble und gefiltertem World-State.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#876](https://github.com/iamthamanic/sagatree/issues/876) — RPC-SAGA-PROJECTIONS; Koordinator [#815](https://github.com/iamthamanic/sagatree/issues/815).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Antwort enthält projectId,sagaPublicId,title,blurb,status,selfRole,isGm,definitionRef,sagaDefinitionId,sagaVersionId,versionLabel,newerVersionAvailable,primaryAction,episodes,ensemble,worldProfileId.
- worldStateSummary liefert clocks,consequences,openDeadlines,partyLocationRef,flagCount,updatedAt aus der rollenabhängig projizierten Adventure-Struktur.
- Migration093 und die transitive Adventure-Projektion sind wirksam; historische frühere Overview-Versionen sind kein weiterer Overload.

## Berechtigungen

- Authentifizierter aktiver Projektteilnehmer oder GM; Public-ID-Auflösung allein genügt nicht.

## SQL-Signatur 1

`public.get_saga_overview(text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_public_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/093_fix_saga_overview_shared_adventure.sql](../../../supabase/migrations/093_fix_saga_overview_shared_adventure.sql) (Zeilen 1–299, SHA-256 `ee626a51f06984449a2fa4abd98db18d83626f0d432f46c7b63b32b401c57904`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_saga_overview-1.sql](effective-sql/get_saga_overview-1.sql); SHA-256 `e2d06c0d522c7b0f4c4d015d8dd589157b7423dff8de88cf8014028938c56d6c`.

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
| 264 | unbedingt | `jsonb_build_object(     'projectId', v_project.id,     'sagaPublicId', v_project.public_id,     'title', v_project.name,     'blurb', COALESCE(v_project.description, ''),     'status', v_project.status,     'selfRole', v_role,     'isGm', v_is_gm,     'definitionRef', v_adv->>'definitionRef',     'sagaDefinitionId', v_saga_def_id,     'sagaVersionId', v_saga_ver_id,     'versionLabel', v_version_label,     'newerVersionAvailable', v_newer,     'primaryAction', v_primary,     'episodes', v_episodes,     'ensemble', v_ensemble,     'worldProfileId', v_project.world_profile_id,     'worldStateSummary', jsonb_build_object(       'clocks', v_clocks,       'consequences', v_consequences,       'openDeadlines', v_open_deadlines,       'partyLocationRef', NULLIF(BTRIM(COALESCE(v_adv->>'partyLocationRef', '')), ''),       'flagCount', public.jsonb_object_keys_count(v_adv->'flags'),       'updatedAt', v_adv->>'updatedAt'     )   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `adventure`
- `clocks`, `consequences`, `openDeadlines`, `partyLocationRef`, `flagCount`, `updatedAt`
- `id`, `label`, `dueDay`, `visibility`
- `id`, `label`, `value`, `max`, `visibility`
- `kind`, `labelDe`, `sessionPublicId`
- `projectId`, `sagaPublicId`, `title`, `blurb`, `status`, `selfRole`, `isGm`, `definitionRef`, `sagaDefinitionId`, `sagaVersionId`, `versionLabel`, `newerVersionAvailable`, `primaryAction`, `episodes`, `ensemble`, `worldProfileId`, `worldStateSummary`
- `sessionId`, `sessionPublicId`, `sessionNumber`, `name`, `status`, `startedAt`, `endedAt`, `recapSnippet`
- `sessionPublicId`, `sessionNumber`, `status`, `name`
- `userId`, `role`, `characterId`, `characterName`, `isSelf`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| P0002 | Saga not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT v_is_gm AND NOT v_is_member |

## Transaktion, Idempotenz und Folgewirkungen

- Reiner Lese-/Projektionsvertrag; kein automatischer Session-Start und kein Upgrade auf neuere Saga-Version.

**Direkt referenzierte reale Relationen:** `public.characters`, `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.session_recaps`, `public.sessions`.

**Transitive reale Relationen:** `public.characters`, `public.project_members`, `public.projects`, `public.saga_definition_versions`, `public.session_recaps`, `public.sessions`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.is_project_gm(uuid,uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | True/True |
| `public.jsonb_object_keys_count(jsonb)` | [supabase/migrations/060_saga_overview.sql](../../../supabase/migrations/060_saga_overview.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_build_recap_highlight_lines(jsonb,boolean)` | [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | Keine eigene RAISE | True/True |
| `public.sagatree_project_shared_adventure(jsonb,boolean)` | [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/project/saga-overview-service.ts:31

AST-Auflösung: `string-literal`; SHA-256 `65bf2badf498e31c53757b3d94a766e2ad4282afee6591004e837863ace2e074`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async getOverviewByPublicId(sagaPublicId: string): Promise<SagaOverviewVm> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (!publicId) {
      throw new Error('Saga-ID fehlt');
    }

    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_overview', { p_public_id: publicId }),
      SAGA_OVERVIEW_TIMEOUT_MS,
      'Saga-Übersicht Zeitüberschreitung',
    );

    if (error) {
      const message = error.message || 'Saga-Übersicht fehlgeschlagen';
      if (/not authenticated|forbidden|42501/i.test(message)) {
        throw new Error('Kein Zugriff auf diese Saga');
      }
      if (/not found|P0002/i.test(message)) {
        throw new Error('Saga nicht gefunden');
      }
      throw new Error(message);
    }

    if (data == null) {
      throw new Error('Saga-Übersicht leer');
    }

    const vm = parseSagaOverview(data);
    assertSagaOverviewAudienceSafe(vm);
    return vm;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `SagaOverviewRole` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 10 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaPrimaryActionKind` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 12 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaPrimaryAction` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 18 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaEpisodeVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 24 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaEnsembleMemberVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 35 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaOverviewClockVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 43 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaOverviewConsequenceVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 51 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaOverviewDeadlineVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 60 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaWorldStateSummaryVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 67 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SagaOverviewVm` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 77 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `ROLES` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 99 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `PRIMARY_KINDS` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 100 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `isRecord` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 107 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `asString` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 111 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `asNullableString` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 115 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `asNumber` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 119 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseRole` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 128 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parsePrimaryAction` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 137 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseEpisode` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 152 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseEnsembleMember` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 169 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseClock` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 182 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseConsequence` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 195 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseDeadline` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 208 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseWorldStateSummary` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 220 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `parseSagaOverview` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 264 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `assertSagaOverviewAudienceSafe` | [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | 313 | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `SAGA_OVERVIEW_TIMEOUT_MS` | [src/infrastructure/project/saga-overview-service.ts](../../../src/infrastructure/project/saga-overview-service.ts) | 21 | `65bf2badf498e31c53757b3d94a766e2ad4282afee6591004e837863ace2e074` |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] GM und Player derselben Saga erhalten passende primaryAction/selfRole, identische erlaubte Episoden und getrennte geheime World-State-Inhalte.
- [ ] Neue Published-Version setzt newerVersionAvailable ohne bestehende Projektbindung umzuschreiben.
- [ ] Weltgebundene Saga liefert worldProfileId; fehlende Runtime-Daten produzieren die dokumentierte leere Summary.
- [ ] Fremdes oder inaktives Mitglied wird abgewiesen; vollständige Overview-Decoder-Fixture enthält Ensemble und deadline/consequence-Grenzfälle.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/domains/project/contracts/saga-overview.ts](../../../src/domains/project/contracts/saga-overview.ts) | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| [src/infrastructure/project/saga-overview-service.ts](../../../src/infrastructure/project/saga-overview-service.ts) | `65bf2badf498e31c53757b3d94a766e2ad4282afee6591004e837863ace2e074` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
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
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/060_saga_overview.sql](../../../supabase/migrations/060_saga_overview.sql) | `426d83d2aa74cb7538f2e6a71f0b654c423f31cf9dfafcf4f66c62908f9966b3` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/062_session_recap_ai_summary.sql](../../../supabase/migrations/062_session_recap_ai_summary.sql) | `d02f115b12a959b1186539c310726de5791314380cc010ca337014f3045d079a` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/066_saga_between_sessions_bote.sql](../../../supabase/migrations/066_saga_between_sessions_bote.sql) | `c55f1f4ab96ba5b53c89c7cb620d86f476a1c35217a0c9976a7d5b83caed73f8` |
| [supabase/migrations/069_party_location_overview.sql](../../../supabase/migrations/069_party_location_overview.sql) | `568558d8d8776bb2a3ef38a78f870ff3df8d28db274fe35a6b4d5aa85da019a6` |
| [supabase/migrations/072_dornhain_seed_and_character_rls.sql](../../../supabase/migrations/072_dornhain_seed_and_character_rls.sql) | `29174c7ab1b49e3ff1cb9040a8d539ffa7aa1b559730bef57c260b9898a5840a` |
| [supabase/migrations/073_sagatree_schema_rename_compat.sql](../../../supabase/migrations/073_sagatree_schema_rename_compat.sql) | `f1892766c1b12e6877e009355fcbd7a4e0c9abe264d36c0880a018802094b608` |
| [supabase/migrations/079_drop_sagadrive_aliases.sql](../../../supabase/migrations/079_drop_sagadrive_aliases.sql) | `bb8d1160118231cb724d0e01fbe5b66ba20dde397b67e052e03d8a1a9f2e6dd0` |
| [supabase/migrations/089_gm_presence_character_type.sql](../../../supabase/migrations/089_gm_presence_character_type.sql) | `f66c1286947dd3119ac4cfac01736a3948e1cb35648f61837e6a79fd9c519560` |
| [supabase/migrations/091_saga_overview_world_profile_id.sql](../../../supabase/migrations/091_saga_overview_world_profile_id.sql) | `9cbda2bc6b50e312ecd4d848bd52d85e93bc34e5b2571ed97219c145056d3c10` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/093_fix_saga_overview_shared_adventure.sql](../../../supabase/migrations/093_fix_saga_overview_shared_adventure.sql) | `ee626a51f06984449a2fa4abd98db18d83626f0d432f46c7b63b32b401c57904` |
