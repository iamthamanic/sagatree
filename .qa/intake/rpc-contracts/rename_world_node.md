# RPC-Vertrag: `rename_world_node`

Benennt einen vorhandenen Weltknoten um und macht einen Placeholder zum Draft.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#864](https://github.com/iamthamanic/sagatree/issues/864) — RPC-WORLD-CREATE; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Name wird getrimmt und muss nicht leer sein; Ort muss in der angegebenen Welt existieren.
- Update erhöht Ortsrevision, setzt neuen Namen und wandelt nur placeholder→draft um; andere Status bleiben bestehen.
- Antwort wird über atlas_wb_place_json erzeugt; anwendbare Orts-Trigger gehören zum Vertrag.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.rename_world_node(uuid,uuid,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_name | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) (Zeilen 114–158, SHA-256 `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/rename_world_node-1.sql](effective-sql/rename_world_node-1.sql); SHA-256 `b97ce0d8477a58790563f2a6113eb251771f435a2db171e6700b206b740b5cd0`.

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
| 29 | unbedingt | `public.atlas_wb_place_json(v_row)` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | auth.uid() IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | empty name | — | v_name IS NULL |

## Transaktion, Idempotenz und Folgewirkungen

- Ein Ortsupdate mit Triggern; kein erwarteter Revisionswert und keine Request-Deduplizierung.

**Direkt referenzierte reale Relationen:** `public.world_places`.

**Transitive reale Relationen:** `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.rename_world_node(uuid,uuid,text)` | UPDATE | `public.world_places` | name, status, revision, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.rename_world_node(uuid,uuid,text)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_place_json(public.world_places)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_place_row(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | P0002 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.world_places_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:209

AST-Auflösung: `string-literal`; SHA-256 `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async renameNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly name: string;
  }): Promise<WorldPlaceVm> {
    if (isHostLibraryEnabled()) {
      const data = await renameHostWorldNode({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        name: input.name,
      });
      const parsed = parseWorldPlaceVm(data);
      if (!parsed) throw new Error('Umbenennen: ungültige Antwort');
      return parsed;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('rename_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_name: input.name,
    });
    if (error) throw new Error(`Umbenennen fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Umbenennen: ungültige Antwort');
    return parsed;
  }
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `EnvLike` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 11 | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| `defaultEnv` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 16 | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| `isHostLibraryExplicitlyDisabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 25 | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| `isHostLibraryEnabled` | [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | 30 | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| `EnvLike` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 12 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `defaultEnv` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 17 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `hostMutateJson` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 68 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `renameHostWorldNode` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 318 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `API_AUTH_REQUIRED_DE` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 24 | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| `JWT_WAIT_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 27 | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| `JWT_POLL_MS` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 28 | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| `getAuthenticatedUserId` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 30 | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| `assertSupabaseJwtSession` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 64 | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| `HOST_AUTH_PROBE_TIMEOUT_MS` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 13 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `HOST_AUTH_SESSION_BEARER_KEYS` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 16 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `HostWhoamiDto` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 24 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `EnvLike` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 31 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `defaultEnv` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 33 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `getHostAuthBaseUrl` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 46 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `scrubHostAuthJson` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 56 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `probeHostActor` | [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | 80 | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| `LOCAL_ADMIN_STORAGE_KEY` | [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | 15 | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `LEGACY_LOCAL_ADMIN_STORAGE_KEY` | [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | 17 | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `LOCAL_ADMIN_USER_ID` | [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | 23 | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `isLocalAdminEnabled` | [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | 31 | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `isLocalAdminSession` | [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | 35 | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `AUTH_SESSION_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 7 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `SUPABASE_QUERY_TIMEOUT_MS` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 8 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TIMED_OUT` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 10 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `TimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 12 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `isTimedOut` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 14 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutOrSymbol` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 27 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `raceWithTimeoutReject` | [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | 36 | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 13 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 15 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 16 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostAuthUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 17 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `hostFirst` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 18 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 58 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 59 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 61 | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

## Konkrete Abnahmekriterien

- [ ] Placeholder umbenennen ergibt draft und Revision+1; bestehender anderer Status bleibt erhalten.
- [ ] Name mit Leerzeichen wird getrimmt; leerer Name22023 ohne Update.
- [ ] Fremder/nicht existierender Weltort wird abgewiesen und keine andere Welt geändert.
- [ ] Decoder und durch Trigger entstandene Primärkarten-Metadaten anhand echter DB-Fixture prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/host/host-library-http.ts](../../../src/infrastructure/host/host-library-http.ts) | `88754decbf6c4b587d9901f090eb63cd2bb9406e34086984acb9e316196ae84c` |
| [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4` |
| [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | `6511efe22e63dcd5a964bfb413f1ab8aa1beda804abcf7d4e5936e617b6d169b` |
| [src/lib/hostAuthBridge.ts](../../../src/lib/hostAuthBridge.ts) | `ff246980f94464bf05521d7787980161efb37e0db60125a953b4efec97c54529` |
| [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90` |
