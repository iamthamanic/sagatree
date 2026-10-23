# RPC-Vertrag: `get_world_atlas_map`

Liefert genau eine Atlas-Karte mit erzwungener Party-Geometrie-/Metadatenprojektion.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#862](https://github.com/iamthamanic/sagatree/issues/862) — RPC-ATLAS-MAPS; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Nach Migration106 existiert ausschließlich (p_map_id uuid,p_player_view boolean DEFAULTfalse,p_saga_public_id text DEFAULTNULL); der zweiparametrige Wrapper ist entfernt.
- Nicht-Editor oder player_view=true benötigt aufgelöstes Saga-Projekt und Karte in dessen erlaubter Kartenmenge, sonst P0002.
- Party filtert Features mit properties.secret=true oder discovered=false; generatorMeta wird auf {engine: gespeicherter Wert oder unified_canvas} reduziert. Azgaar-Pfad wird NULL; unerlaubter Parent wird NULL. Basemap-Pfad bleibt enthalten.
- Antwort umfasst id,worldProfileId,parentMapId,kind,title,sortOrder,bounds,layers,basemapStoragePath,azgaarMapStoragePath,generatorMeta,revision,updatedAt.

## Berechtigungen

- Authentifizierung und current_user_can_read_world_profile: Welt-Owner oder GM/aktives Mitglied eines an die Welt gebundenen Projekts.

## SQL-Signatur 1

`public.get_world_atlas_map(uuid,boolean,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_map_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_player_view | `boolean` | DEFAULT | `FALSE` |
| p_saga_public_id | `text` | DEFAULT | `NULL` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 928–1038, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_world_atlas_map-1.sql](effective-sql/get_world_atlas_map-1.sql); SHA-256 `ed9c1232f4c6116213d7562f3c0e547bb5b66eaba1895071b60e8e1d2d2a7764`.

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
| postgres | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | False |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 78 | unbedingt | `jsonb_build_object(     'id', v_row.id,     'worldProfileId', v_row.world_profile_id,     'parentMapId', v_parent,     'kind', v_row.kind,     'title', v_row.title,     'sortOrder', v_row.sort_order,     'bounds', v_row.bounds,     'layers', v_layers,     'basemapStoragePath', v_row.basemap_storage_path,     'azgaarMapStoragePath', CASE       WHEN v_party_only THEN NULL       ELSE v_row.azgaar_map_storage_path     END,     'generatorMeta', v_meta,     'revision', v_row.revision,     'updatedAt', v_row.updated_at   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `engine`, `unifiedCanvas`, `webglRuntime`, `mapFrame`, `dungeon`
- `id`, `worldProfileId`, `parentMapId`, `kind`, `title`, `sortOrder`, `bounds`, `layers`, `basemapStoragePath`, `azgaarMapStoragePath`, `generatorMeta`, `revision`, `updatedAt`
- `type`, `features`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | map_id required | — | p_map_id IS NULL |
| P0002 | not found | — | NOT FOUND |
| 42501 | forbidden | — | NOT public.current_user_can_read_world_profile(v_row.world_profile_id) |
| 42501 | forbidden | — | v_party_only ∧ p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' ∧ v_project IS NULL OR NOT public.current_user_is_active_project_member(v_project) |
| P0002 | not found | — | v_party_only ∧ v_project IS NULL |
| P0002 | not found | — | v_party_only ∧ NOT (p_map_id = ANY (v_allowed)) |

## Transaktion, Idempotenz und Folgewirkungen

- Reiner Lesevertrag; keine Revisionserhöhung.

**Direkt referenzierte reale Relationen:** `public.world_atlas_maps`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_party_revealed_map_ids(uuid,uuid)` | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_resolve_saga_project(uuid,text)` | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-atlas-service.ts:74

AST-Auflösung: `string-literal`; SHA-256 `252141b947176fbc28c1b353e0473eec2d18cef19ec671e8f89ac8998d107de1`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async getMap(
    mapId: string,
    playerView = false,
    sagaPublicId?: string | null,
  ): Promise<WorldAtlasMapVm> {
    await assertSupabaseJwtSession();
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    const { data, error } = await supabase.rpc('get_world_atlas_map', {
      p_map_id: id,
      p_player_view: playerView,
      p_saga_public_id: sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Atlas-Karte konnte nicht geladen werden: ${error.message}`);
    return parseWorldAtlasMapVm(data);
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
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

## Beobachteter isolierter HTTP-Transport

Diese konkreten Fälle wurden über echte GoTrue-Authentifizierung und PostgREST 12.0.1 gemessen. Die gespeicherten Harness-Hashes bezeichnen ausschließlich den damaligen Ausführungsstand zum observedAt-Zeitpunkt; später veränderte Harness-Dateien werden dadurch nicht als erneut ausgeführt oder aktuell verifiziert ausgewiesen. Daraus folgt keine allgemeine SQLSTATE→HTTP-Mappingtabelle für alle RPCs.

| RPC-Pfad | Rolle | HTTP | SQLSTATE | Meldung |
| --- | --- | --- | --- | --- |
| /rest/v1/rpc/get_world_atlas_map | player1 | 500 | P0002 | not found |

Beleg: [.qa/intake/rpc-contracts/transport-observations.json](transport-observations.json); SHA-256 `12cafb85433a188d601f1e4231ed32dfffc1da697bb4093867ffc0bdc9a9e03b`.

## Konkrete Abnahmekriterien

- [ ] Ein-/Zwei-/Dreiparameter-Defaultauflösung ist eindeutig; entfernter Zweiparameter-Overload taucht nicht im Katalog auf.
- [ ] Player bekommt nur freigegebene Karte seiner Saga und gefilterte Features/Meta/Parent/Azgaar; keine Freigabe ergibt P0002.
- [ ] SagaA-Mitglied mit SagaB-Public-ID wird vor fremden Party-Daten geschützt (Legacy-Blocker).
- [ ] Editor bekommt vollständige Geometrie; map_id NULL22023, unbekannte MapP0002, fremde Welt42501; Decoder prüft GeoJSON.
- [ ] Transport-Abbildung gegen den belegten SQLSTATE explizit abnehmen: isoliertes PostgREST 12.0.1 liefert hier HTTP 500 mit code=P0002. Andere HTTP-Statuswerte im Nachfolger benötigen eine dokumentierte API-Entscheidung.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### High — RPC-SEC-CROSS-SAGA-REVEAL

Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.

**Beleg:** supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.

**Erforderliche Nachfolger-Abnahme:** Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-CROSS-SAGA`. Eigene RPC-Reproduktion: False.

The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture.

## Entfernte historische Signaturen

| Entfernte Signatur | Grund | Quelle |
| --- | --- | --- |
| `public.get_world_atlas_map(uuid,boolean)` | explicit DROP FUNCTION | [supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../supabase/migrations/105_atlas_worldbuilder_player_projection.sql) (Zeilen 192–198, SHA-256 `8ab33d4d6ace74d129350524607e5e3e9ceab4a4c1d06c9d59b867be4899eacf`) |
| `public.get_world_atlas_map(uuid,boolean)` | explicit DROP FUNCTION | [supabase/migrations/106_atlas_get_map_overload_fix.sql](../../../supabase/migrations/106_atlas_get_map_overload_fix.sql) (Zeilen 1–6, SHA-256 `7710abc048b018cb9505fad8767792baa659f49943ae1ee38b85222f69449a2d`) |

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
| [supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
