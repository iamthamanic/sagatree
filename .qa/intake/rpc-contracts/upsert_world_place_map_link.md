# RPC-Vertrag: `upsert_world_place_map_link`

Verknüpft Ort und Karte innerhalb derselben Welt oder aktualisiert die bestehende Usage-Verknüpfung.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#863](https://github.com/iamthamanic/sagatree/issues/863) — RPC-WORLD-PLACES; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Welt/Ort/Karte/usage erforderlich; feature_id DEFAULTNULL und anchor DEFAULT{}.
- Ort und Karte müssen beide zur angegebenen Welt gehören. UPSERT-Key ist (place_id,map_id,usage); Konflikt aktualisiert feature_id/anchor.
- Antwort id,worldProfileId,placeId,mapId,usage,featureId,anchor; Primary-Link-/Hierarchy-Trigger sind zusätzlich wirksam.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.upsert_world_place_map_link(uuid,uuid,uuid,text,text,jsonb)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_map_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_usage | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_feature_id | `text` | DEFAULT | `NULL` |
| p_anchor | `jsonb` | DEFAULT | `CAST('{}' AS jsonb)` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/096_donalu_place_map_link_rpc.sql](../../../supabase/migrations/096_donalu_place_map_link_rpc.sql) (Zeilen 1–68, SHA-256 `612ff70eba98246ee09fe90f8c80f0e6dbeab570b866ab4041cf01bb43286db6`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/upsert_world_place_map_link-1.sql](effective-sql/upsert_world_place_map_link-1.sql); SHA-256 `c1a5ed23266e6bf0c5ad6f38ff9bffb050b819868d9dc7f00ddb125fc8c85055`.

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
| 45 | unbedingt | `jsonb_build_object(     'id', v_row.id,     'worldProfileId', v_row.world_profile_id,     'placeId', v_row.place_id,     'mapId', v_row.map_id,     'usage', v_row.usage,     'featureId', v_row.feature_id,     'anchor', v_row.anchor   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `worldProfileId`, `placeId`, `mapId`, `usage`, `featureId`, `anchor`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | place, map and usage required | — | p_place_id IS NULL OR p_map_id IS NULL OR p_usage IS NULL OR btrim(p_usage) = '' |
| 22023 | place not in world | — | NOT EXISTS (     SELECT 1 FROM public.world_places p     WHERE p.id = p_place_id AND p.world_profile_id = p_world_profile_id   ) |
| 22023 | map not in world | — | NOT EXISTS (     SELECT 1 FROM public.world_atlas_maps m     WHERE m.id = p_map_id AND m.world_profile_id = p_world_profile_id   ) |

## Transaktion, Idempotenz und Folgewirkungen

- Referenzprüfungen, Link-UPSERT und Trigger laufen atomar; resultierender gleicher Link ist wiederholbar.

**Direkt referenzierte reale Relationen:** `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`.

**Transitive reale Relationen:** `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.upsert_world_place_map_link(uuid,uuid,uuid,text,text,jsonb)` | INSERT | `public.world_place_map_links` | world_profile_id, place_id, map_id, usage, feature_id, anchor | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.upsert_world_place_map_link(uuid,uuid,uuid,text,text,jsonb)` | `public.world_place_map_links` / `trg_world_place_map_links_same_world` | `public.world_place_map_links_enforce_same_world()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.world_place_map_links_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:218

AST-Auflösung: `string-literal`; SHA-256 `0a18cae0d8ac1503ffcb7f149e12f757aea44a6f346f75eb4f44742724e8d6c0`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async linkMap(input: LinkWorldPlaceMapInput): Promise<WorldPlaceMapLinkVm> {
    await assertSupabaseJwtSession();
    if (!isWorldPlaceMapUsage(input.usage)) {
      throw new Error(`Ungültige Kartenverwendung: ${input.usage}`);
    }
    const { data, error } = await supabase.rpc('upsert_world_place_map_link', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_map_id: input.mapId.trim(),
      p_usage: input.usage,
      p_feature_id: input.featureId ?? null,
      p_anchor: input.anchor ?? {},
    });
    if (error) throw new Error(`Kartenverknüpfung fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceMapLinkVm(data);
    if (!parsed) throw new Error('Kartenverknüpfung: ungültige Antwort');
    return parsed;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `LinkWorldPlaceMapInput` | [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | 24 | `0a18cae0d8ac1503ffcb7f149e12f757aea44a6f346f75eb4f44742724e8d6c0` |
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

- [ ] Neuer Link wird einmal angelegt; gleicher Ort/Map/Usage aktualisiert dieselbe Link-ID.
- [ ] Fremde Welt-Ort-/Kartenkombination scheitert ohne Link.
- [ ] Primärverknüpfung gegen aktive Unique-/Hierarchie-Trigger und zweite Primary-Zuordnung testen.
- [ ] NULL-feature und leeres anchor bleiben im Decoder korrekt; Nicht-Owner42501.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | `0a18cae0d8ac1503ffcb7f149e12f757aea44a6f346f75eb4f44742724e8d6c0` |
| [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/094_world_atlas.sql](../../../supabase/migrations/094_world_atlas.sql) | `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/096_donalu_place_map_link_rpc.sql](../../../supabase/migrations/096_donalu_place_map_link_rpc.sql) | `612ff70eba98246ee09fe90f8c80f0e6dbeab570b866ab4041cf01bb43286db6` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../supabase/migrations/102_world_atlas_player_redaction_force.sql) | `a1add570f090c4b8cae03170cf5b73bc7eba6ccc2a0f785d3d1910d0a3178bb3` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
