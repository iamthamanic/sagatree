# RPC-Vertrag: `upsert_world_place`

Erstellt oder aktualisiert einen Weltort und erhöht dessen Revision.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#863](https://github.com/iamthamanic/sagatree/issues/863) — RPC-WORLD-PLACES; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Neun erforderliche Parameter; NULL place_id legt an, vorhandene ID wird nur innerhalb derselben Welt aktualisiert.
- kind/name müssen gesetzt sein; Default-/Statusnormalisierung und parent/hierarchy-Prüfungen folgen der SQL-Funktion plus späteren Weltort-Triggern.
- Neuer Ort erhält die SQL-Defaults, Update ersetzt die übergebenen Felder und erhöht revision; fehlender UpdateortP0002.
- Antwort ist der festgelegte Orts-JSON-DTO; keine gesamte places-Liste.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.upsert_world_place(uuid,uuid,uuid,text,text,text,text,text,integer)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_parent_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_kind | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_name | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_description | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_status | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_seed_key | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_sort_order | `integer` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) (Zeilen 516–594, SHA-256 `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/upsert_world_place-1.sql](effective-sql/upsert_world_place-1.sql); SHA-256 `c0750fcddf807f086f7084d8a1e3460e13a7617f5c064478f772b918a121fe18`.

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
| 49 | unbedingt | `jsonb_build_object(     'id', v_row.id,     'worldProfileId', v_row.world_profile_id,     'parentPlaceId', v_row.parent_place_id,     'kind', v_row.kind,     'name', v_row.name,     'description', v_row.description,     'status', v_row.status,     'seedKey', v_row.seed_key,     'sortOrder', v_row.sort_order,     'revision', v_row.revision   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `worldProfileId`, `parentPlaceId`, `kind`, `name`, `description`, `status`, `seedKey`, `sortOrder`, `revision`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | kind and name required | — | p_kind IS NULL OR p_name IS NULL OR btrim(p_name) = '' |
| P0002 | not found | — | ELSE AFTER: p_place_id IS NULL ∧ NOT FOUND |

## Transaktion, Idempotenz und Folgewirkungen

- Orts-Write und anwendbare Hierarchie-/Karten-Trigger sind atomar; kein erwarteter Revisionsparameter und kein Request-Key.

**Direkt referenzierte reale Relationen:** `public.world_places`.

**Transitive reale Relationen:** `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.upsert_world_place(uuid,uuid,uuid,text,text,text,text,text,integer)` | INSERT | `public.world_places` | world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order | p_place_id IS NULL |
| `public.upsert_world_place(uuid,uuid,uuid,text,text,text,text,text,integer)` | UPDATE | `public.world_places` | parent_place_id, kind, name, description, status, seed_key, sort_order, revision, updated_at | ELSE AFTER: p_place_id IS NULL |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.upsert_world_place(uuid,uuid,uuid,text,text,text,text,text,integer)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |
| `public.upsert_world_place(uuid,uuid,uuid,text,text,text,text,text,integer)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.world_places_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:108

AST-Auflösung: `string-literal`; SHA-256 `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
    if (isHostLibraryEnabled()) {
      const data = await upsertHostWorldPlace({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId ?? null,
        parentPlaceId: input.parentPlaceId ?? null,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        seedKey: input.seedKey ?? null,
        sortOrder: input.sortOrder ?? 0,
      });
      const parsed = parseWorldPlaceVm(data);
      if (!parsed) throw new Error('Ort speichern: ungültige Antwort');
      return parsed;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_place', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_kind: input.kind,
      p_name: input.name,
      p_description: input.description ?? null,
      p_status: input.status ?? 'draft',
      p_seed_key: input.seedKey ?? null,
      p_sort_order: input.sortOrder ?? 0,
    });
    if (error) throw new Error(`Ort speichern fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Ort speichern: ungültige Antwort');
    return parsed;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `3d8c732df0b3b41e538309309b9b2af84134afefcb7e97920b1e561db296e12a` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `3d8c732df0b3b41e538309309b9b2af84134afefcb7e97920b1e561db296e12a` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `3d8c732df0b3b41e538309309b9b2af84134afefcb7e97920b1e561db296e12a` |
| `EnvLike` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 12 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `defaultEnv` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 17 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `hostMutateJson` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 68 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `upsertHostWorldPlace` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 232 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `API_AUTH_REQUIRED_DE` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 24 | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `JWT_WAIT_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 27 | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `JWT_POLL_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 28 | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `assertSupabaseJwtSession` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 65 | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `EnvLike` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 31 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `defaultEnv` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 33 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `getHostAuthBaseUrl` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 53 | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `AUTH_SESSION_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 7 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TIMED_OUT` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 10 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 12 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `isTimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 14 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutOrSymbol` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 27 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 13 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 15 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 16 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostAuthUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 17 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostFirst` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 18 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 58 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 59 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 61 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

## Konkrete Abnahmekriterien

- [ ] NULL-ID erzeugt neuen Ort, vorhandene eigene ID aktualisiert Name/Description/Status/Sortierung mit genau einer Revisionssteigerung.
- [ ] Fremde Welt-/Parent-Referenz, Zyklus und ungültige Hierarchiekante werden über Funktion/Trigger abgewiesen ohne Teilmutation.
- [ ] Fehlender OrtP0002 und leerer Name/Kind22023; Projekt-GM ohne Ownership42501.
- [ ] Legacy- und kanonische Kind-Werte gegen tatsächliche Constraints testen; Antwortfelder und NULL-Description decodieren.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `3d8c732df0b3b41e538309309b9b2af84134afefcb7e97920b1e561db296e12a` |
| [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4` |
| [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
