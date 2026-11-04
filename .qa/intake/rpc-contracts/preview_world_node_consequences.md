# RPC-Vertrag: `preview_world_node_consequences`

Berechnet die Auswirkungen einer Teilbaumoperation ohne zu schreiben.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#866](https://github.com/iamthamanic/sagatree/issues/866) — RPC-WORLD-DESTRUCTIVE; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Ermittelt alle rekursiven Nachfahren und zählt Saga-Asset-Bindings für Wurzel plus Nachfahren.
- Antwort placeId,childCount,sagaBindingCount,requiresConfirm,descendantIds; requiresConfirm folgt vorhandenen Kindern oder Bindings.
- Die Vorschau autorisiert nur den Editor und ersetzt keine erneute Prüfung in der späteren Mutation.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.preview_world_node_consequences(uuid,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) (Zeilen 71–114, SHA-256 `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/preview_world_node_consequences-1.sql](effective-sql/preview_world_node_consequences-1.sql); SHA-256 `85d05443e61d001e0489e1e944680d8fa8073f61f870981440083110c028c886`.

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
| 23 | unbedingt | `jsonb_build_object(     'placeId', p_place_id,     'childCount', v_child,     'sagaBindingCount', v_bind,     'requiresConfirm', (v_child > 0 OR v_bind > 0),     'descendantIds', to_jsonb(v_desc)   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `placeId`, `childCount`, `sagaBindingCount`, `requiresConfirm`, `descendantIds`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | auth.uid() IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |

## Transaktion, Idempotenz und Folgewirkungen

- Reines Lesen; Mutation berechnet eigene Vorschau erneut, kein gespeicherter Freigabetoken.

**Direkt referenzierte reale Relationen:** `public.saga_asset_bindings`.

**Transitive reale Relationen:** `public.saga_asset_bindings`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_descendant_ids(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_place_row(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | P0002 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:184

AST-Auflösung: `string-literal`; SHA-256 `c8b48bc3e5ecdf33ecfe6db705115f17b423a7fbf5e504aa89d815cdf27551b4`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
async previewNodeConsequences(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
      const data = await previewHostWorldNodeConsequences({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
      });
      if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('preview_world_node_consequences', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
    });
    if (error) throw new Error(`Folgenabschätzung fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
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
| `previewHostWorldNodeConsequences` | [src/infrastructure/host/host-world-http.ts](../../../src/infrastructure/host/host-world-http.ts) | 306 | `bfb69f91e69543a66ee96cab4ad21273c86a2b167e4c21211c42c7e6ccb3c072` |
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

- [ ] Blatt ohne Bindings erfordert keine Bestätigung; Blatt mit Binding und Elternknoten mit Kind erfordern sie.
- [ ] Mehrstufiger Baum liefert eindeutige Nachfahren-IDs und korrekte projektübergreifende Binding-Anzahl.
- [ ] Fremder/nicht existierender Ort wird abgewiesen; Player/Projekt-GM ohne Ownership42501.
- [ ] Vorher/nachher Tabellenfingerprints identisch; zwischen Vorschau und Delete geänderte Struktur muss der Mutations-Preview folgen.

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
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90` |
