# RPC-Vertrag: `upsert_world_atlas_map`

Legt Atlas-Karten an oder ersetzt sie mit Revisionskontrolle und GeoJSON-Validierung.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#862](https://github.com/iamthamanic/sagatree/issues/862) — RPC-ATLAS-MAPS; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Zwölf benannte SQL-Parameter sind erforderlich; NULL map_id bedeutet Neuanlage. Erlaubte kind-Werte: world,region,settlement,scene,legacy_tiles.
- layers wird bei NULL zur leeren FeatureCollection. Der SQL-Guard prüft JSON-Objekttyp, type=FeatureCollection und höchstens 1.500.000 Bytes; er validiert nicht jede GeoJSON-Geometrie. Parent-Karte muss derselben Welt angehören.
- Neue Karte startet mit Revision 1. Update vergleicht eine nicht-NULL erwartete Revision; NULL überspringt diesen Vergleich. Fehlendes Ziel oder Konflikt führt zu 40001. NULL Storage-Pfade und NULL sort_order erhalten beim Update den alten Wert; NULL bounds/layers/meta verwenden dagegen die im SQL definierten Defaults.
- Return ruft get_world_atlas_map(id,false) auf; die nach106 verbleibende Dreiargumentfunktion liefert dank Default eine eindeutige Editor-Antwort.
- Leerer/NULL kind wird world, leerer/NULL title wird Weltkarte. NULL bounds wird {minX:0,minY:0,maxX:1000,maxY:1000}; NULL generator_meta wird {}. Diese Wertnormalisierung besteht trotz fehlender SQL-Parameterdefaults.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.upsert_world_atlas_map(uuid,uuid,uuid,text,text,integer,jsonb,jsonb,text,text,jsonb,bigint)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_map_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_parent_map_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_kind | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_title | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_sort_order | `integer` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_bounds | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_layers | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_basemap_storage_path | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_azgaar_map_storage_path | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_generator_meta | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_expected_revision | `bigint` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql) (Zeilen 240–338, SHA-256 `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/upsert_world_atlas_map-1.sql](effective-sql/upsert_world_atlas_map-1.sql); SHA-256 `9c81a700514a337203e2cbece2f0849b5b7ae4e53cdb68f12531712c52aaba18`.

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
| 77 | unbedingt | `public.get_world_atlas_map(v_id, false)` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | world_profile_id required | — | p_world_profile_id IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | invalid kind | — | v_kind NOT IN ('world', 'region', 'settlement', 'scene', 'legacy_tiles') |
| 22023 | layers too large | — | v_layer_bytes > 1500000 |
| 22023 | layers must be a GeoJSON FeatureCollection | — | COALESCE(jsonb_typeof(v_layers), '') <> 'object'      OR COALESCE(v_layers->>'type', '') <> 'FeatureCollection' |
| 22023 | parent map not in world | — | p_parent_map_id IS NOT NULL ∧ NOT EXISTS (       SELECT 1 FROM public.world_atlas_maps p       WHERE p.id = p_parent_map_id AND p.world_profile_id = p_world_profile_id     ) |
| 40001 | revision conflict or map not found | — | ELSE AFTER: p_map_id IS NULL ∧ v_id IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Kartenupdate/Insert und Trigger plus anschließende Projektion sind eine Transaktion; Wiederholung mit alter Revision scheitert.

**Direkt referenzierte reale Relationen:** `public.world_atlas_maps`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.upsert_world_atlas_map(uuid,uuid,uuid,text,text,integer,jsonb,jsonb,text,text,jsonb,bigint)` | INSERT | `public.world_atlas_maps` | world_profile_id, parent_map_id, kind, title, sort_order, bounds, layers, basemap_storage_path, azgaar_map_storage_path, generator_meta, revision | p_map_id IS NULL |
| `public.upsert_world_atlas_map(uuid,uuid,uuid,text,text,integer,jsonb,jsonb,text,text,jsonb,bigint)` | UPDATE | `public.world_atlas_maps` | parent_map_id, kind, title, sort_order, bounds, layers, basemap_storage_path, azgaar_map_storage_path, generator_meta, revision, updated_at | ELSE AFTER: p_map_id IS NULL |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_party_revealed_map_ids(uuid,uuid)` | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_resolve_saga_project(uuid,text)` | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.get_world_atlas_map(uuid,boolean,text)` | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | 22023, 42501, P0002 | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-atlas-service.ts:85

AST-Auflösung: `string-literal`; SHA-256 `252141b947176fbc28c1b353e0473eec2d18cef19ec671e8f89ac8998d107de1`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_atlas_map', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_map_id: input.mapId ?? null,
      p_parent_map_id: input.parentMapId ?? null,
      p_kind: input.kind,
      p_title: input.title,
      p_sort_order: input.sortOrder ?? 0,
      p_bounds: input.bounds,
      p_layers: input.layers,
      p_basemap_storage_path: input.basemapStoragePath ?? null,
      p_azgaar_map_storage_path: input.azgaarMapStoragePath ?? null,
      p_generator_meta: input.generatorMeta ?? {},
      p_expected_revision: input.expectedRevision ?? null,
    });
    if (error) {
      if (error.code === '40001' || /revision conflict/i.test(error.message)) {
        throw new Error(
          'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.',
        );
      }
      throw new Error(`Atlas speichern fehlgeschlagen: ${error.message}`);
    }
    return parseWorldAtlasMapVm(data);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `UpsertWorldAtlasMapInput` | [src/infrastructure/world/world-atlas-service.ts](../../../src/infrastructure/world/world-atlas-service.ts) | 23 | `252141b947176fbc28c1b353e0473eec2d18cef19ec671e8f89ac8998d107de1` |
| `API_AUTH_REQUIRED_DE` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 22 | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `JWT_WAIT_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 25 | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `JWT_POLL_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 26 | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `assertSupabaseJwtSession` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 55 | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `AUTH_SESSION_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 7 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TIMED_OUT` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 10 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 12 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `isTimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 14 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutOrSymbol` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 27 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] NULL map_id erzeugt neue Karte. Bestehende ID mit passender Revision erhöht um eins; NULL Storage-Pfade/Sortierung bewahren bestehende Werte, während NULL bounds/layers/meta die definierten Defaults einsetzen.
- [ ] Falsche Revision40001 ohne Teiländerung; fremde Parent-ID oder ungültiger Kind wird abgewiesen.
- [ ] FeatureCollection und1.500.000Byte-Grenze mit Grenzwerten prüfen; fehlerhafte JSON-Struktur ist kein gültiger Erfolg.
- [ ] Gebundener Projekt-GM ohne Welt-Ownership42501; Rückgabe über verbleibenden get_world_atlas_map-Overload korrekt decodiert.
- [ ] NULL p_expected_revision umgeht den Legacy-Vergleich; Nachfolger muss diese Entscheidung ausdrücklich abnehmen. type=FeatureCollection mit ungültigen Geometriefeldern gegen den tatsächlichen begrenzten SQL-Guard und den Client-Decoder testen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/world/world-atlas-service.ts](../../../src/infrastructure/world/world-atlas-service.ts) | `252141b947176fbc28c1b353e0473eec2d18cef19ec671e8f89ac8998d107de1` |
| [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql) | `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql) | `a1add570f090c4b8cae03170cf5b73bc7eba6ccc2a0f785d3d1910d0a3178bb3` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | `8ab33d4d6ace74d129350524607e5e3e9ceab4a4c1d06c9d59b867be4899eacf` |
| [supabase/migrations/106_atlas_get_map_overload_fix.sql](../../../supabase/migrations/106_atlas_get_map_overload_fix.sql) | `7710abc048b018cb9505fad8767792baa659f49943ae1ee38b85222f69449a2d` |
