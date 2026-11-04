# RPC-Vertrag: `list_world_place_map_links`

Listet Kartenverknüpfungen für die Welt oder die freigegebenen Saga-Orte.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#863](https://github.com/iamthamanic/sagatree/issues/863) — RPC-WORLD-PLACES; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Nicht-Editor/Player-Ansicht benötigt gültiges Saga-Projekt; sonst {links:[]}. Auswahl über location-Binding mit reveal=party.
- Party-Query schränkt nicht auf usage=primary ein und enthält keinen eigenen Archived-Ort-Filter; alle Links der zugelassenen Ortsreferenzen werden ausgewählt.
- Elemente id,worldProfileId,placeId,mapId,usage,featureId,anchor; sortiert usage,created_at. Gewählte Saga-Mitgliedschaft wird im Legacy nicht geprüft.

## Berechtigungen

- Authentifizierung und current_user_can_read_world_profile: Welt-Owner oder GM/aktives Mitglied eines an die Welt gebundenen Projekts.

## SQL-Signatur 1

`public.list_world_place_map_links(uuid,boolean,text)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_player_view | `boolean` | DEFAULT | `FALSE` |
| p_saga_public_id | `text` | DEFAULT | `NULL` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/097_donalu_player_place_projection.sql](../../../supabase/migrations/097_donalu_player_place_projection.sql) (Zeilen 97–178, SHA-256 `e454cfc056a397eeb5ba13b13be6f6cf7a229efa241b27867b5d2e2ad0fd9c9f`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/list_world_place_map_links-1.sql](effective-sql/list_world_place_map_links-1.sql); SHA-256 `7709a55afad3a89587edb3c3f2dc880a4e0d408e880dd2ba507e182d661aedf1`.

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
| 28 | v_party_only ∧ v_project IS NULL | `jsonb_build_object('links', '[]'::jsonb)` |
| 69 | unbedingt | `jsonb_build_object('links', COALESCE(v_rows, '[]'::jsonb))` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `id`, `worldProfileId`, `placeId`, `mapId`, `usage`, `featureId`, `anchor`
- `links`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_read_world_profile(p_world_profile_id) |

## Transaktion, Idempotenz und Folgewirkungen

- Reine Join-Projektion; kein Link-Insert oder Update.

**Direkt referenzierte reale Relationen:** `public.projects`, `public.saga_asset_bindings`, `public.world_place_map_links`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.world_place_map_links`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:81

AST-Auflösung: `string-literal`; SHA-256 `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async listMapLinks(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceMapLinkVm[]> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await listHostWorldPlaceMapLinks(id, options);
      return parseWorldPlaceMapLinkList(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('list_world_place_map_links', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Kartenverknüpfungen fehlgeschlagen: ${error.message}`);
    return parseWorldPlaceMapLinkList(data);
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
| `qs` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 25 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `hostGetJson` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 35 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `listHostWorldPlaceMapLinks` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 219 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
| `ListWorldPlacesOptions` | [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | 35 | `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4` |
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

- [ ] Freigegebener Ort mit mehreren usages liefert die belegten Links; nicht freigegebener Ort erscheint nicht.
- [ ] Ohne Saga-Kontext leere Liste; fremder Saga-Kontext derselben Welt wird im sicheren Nachfolger abgewehrt.
- [ ] Archived-Ort und doppelte party-Bindings explizit gegen Legacy-/Nachfolgerentscheidung prüfen, damit keine stillen Projektionsannahmen entstehen.
- [ ] Editor-Liste und nullable featureId/anchor-Decoder prüfen; fremder Welt-Leser42501.

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
| `public.list_world_place_map_links(uuid)` | explicit DROP FUNCTION | [supabase/migrations/097_donalu_player_place_projection.sql](../../../supabase/migrations/097_donalu_player_place_projection.sql) (Zeilen 178–181, SHA-256 `e454cfc056a397eeb5ba13b13be6f6cf7a229efa241b27867b5d2e2ad0fd9c9f`) |

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
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/097_donalu_player_place_projection.sql](../../../supabase/migrations/097_donalu_player_place_projection.sql) | `e454cfc056a397eeb5ba13b13be6f6cf7a229efa241b27867b5d2e2ad0fd9c9f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
