# RPC-Vertrag: `save_world_map`

Speichert die Legacy-Weltkarte mit Größen-/Bildpfadprüfung und optional erzwungener Revision.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#861](https://github.com/iamthamanic/sagatree/issues/861) — RPC-WORLD-MAP; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- map_data muss Objekt sein; size wird als Integer gelesen (Default24), erlaubt1–60. Pins dürfen keine data:-imagePath und keine Pfade über512Zeichen enthalten.
- Vorhandene Karte wird FOR UPDATE gesperrt; nichtnegative erwartete Revision muss passen, sonst40001. NULL/negative Erwartung überspringt die Konfliktprüfung.
- Neue Karte startet mit Revision1 unabhängig von p_expected_revision; Update erhöht um1. Antwort {worldProfileId,revision,mapData,updatedAt}.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.save_world_map(uuid,bigint,jsonb)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_expected_revision | `bigint` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_map_data | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql) (Zeilen 145–216, SHA-256 `5898195600f2fc10330b1444cb288da5d58c59b5373058fa7a5923dfb123fe43`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/save_world_map-1.sql](effective-sql/save_world_map-1.sql); SHA-256 `93b169378c09ef8ec898c65d9c2b25c142d9d0fa100f778fb50c551c1fe28606`.

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
| 55 | unbedingt | `jsonb_build_object(     'worldProfileId', v_row.world_profile_id,     'revision', v_row.revision,     'mapData', v_row.map_data,     'updatedAt', v_row.updated_at   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `worldProfileId`, `revision`, `mapData`, `updatedAt`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | world_profile_id required | — | p_world_profile_id IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | map_data ungültig | — | p_map_data IS NULL OR jsonb_typeof(p_map_data) <> 'object' |
| 22023 | Kartengröße muss zwischen 1 und 60 liegen | — | v_size < 1 OR v_size > 60 |
| 22023 | Pin-Bilder müssen Storage-Pfade sein (kein Base64) | — | EXISTS (     SELECT 1     FROM jsonb_array_elements(COALESCE(p_map_data->'pins', '[]'::jsonb)) AS elem     WHERE COALESCE(elem->>'imagePath', '') LIKE 'data:%'        OR length(COALESCE(elem->>'imagePath', '')) > 512   ) |
| 40001 | revision conflict | — | FOUND ∧ COALESCE(p_expected_revision, -1) >= 0 AND v_row.revision <> p_expected_revision |

## Transaktion, Idempotenz und Folgewirkungen

- Existierende Karte wird per Row-Lock serialisiert; Erst-Insert besitzt Unique-Constraint. Wiederholung erhöht Revision, kein Idempotency-Key.

**Direkt referenzierte reale Relationen:** `public.world_maps`.

**Transitive reale Relationen:** `public.world_maps`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.save_world_map(uuid,bigint,jsonb)` | UPDATE | `public.world_maps` | map_data, revision, updated_at | FOUND |
| `public.save_world_map(uuid,bigint,jsonb)` | INSERT | `public.world_maps` | world_profile_id, revision, map_data, updated_at | ELSE AFTER: FOUND |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-map-service.ts:92

AST-Auflösung: `string-literal`; SHA-256 `952e85442ef9cd7ac198ac33ba6703e58b967ab115efad0183cd240dccddee1e`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async saveMap(
    worldProfileId: string,
    expectedRevision: number,
    mapData: WorldMapData,
  ): Promise<WorldMapVm> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('save_world_map', {
      p_world_profile_id: id,
      p_expected_revision: expectedRevision,
      p_map_data: mapData,
    });
    if (error) throw new Error(`Karte konnte nicht gespeichert werden: ${error.message}`);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Speicherantwort');
    return vm;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Neuanlage und Update liefern Revision1 bzw.+1; Größe1/60 erlaubt,0/61 und data:-Pin/513Zeichen abgewiesen.
- [ ] Konkurrierendes Update mit alter nichtnegativer Revision:40001 ohne Kartenteiländerung.
- [ ] NULL/negative Erwartungsrevision hat expliziten Legacy-Bypass; Nachfolger darf diesen nur mit dokumentierter Entscheidung erhalten.
- [ ] GM einer gebundenen Gruppe ohne Welt-Ownership wird42501; Row-Decoder und JSON-Pins bleiben korrekt.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/world/world-map-service.ts](../../../src/infrastructure/world/world-map-service.ts) | `952e85442ef9cd7ac198ac33ba6703e58b967ab115efad0183cd240dccddee1e` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/068_world_maps.sql](../../../supabase/migrations/068_world_maps.sql) | `5898195600f2fc10330b1444cb288da5d58c59b5373058fa7a5923dfb123fe43` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
