# RPC-Vertrag: `ensure_world_atlas_root`

Stellt eine Atlas-Wurzelkarte bereit und liefert die vollständige Editor-Kartenliste.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#862](https://github.com/iamthamanic/sagatree/issues/862) — RPC-ATLAS-MAPS; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Wählt vorhandene Wurzelkarte mit Priorität legacy_tiles und sort_order; andernfalls neue Wurzel.
- Existiert Legacy-world_maps-Datenmaterial, wird legacy_tiles verwendet, sonst world.
- Rückgabe ist list_world_atlas_maps(world,false,NULL), also {maps:[...]}; kein eigener Karten-Detailvertrag.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.ensure_world_atlas_root(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql) (Zeilen 142–192, SHA-256 `8ab33d4d6ace74d129350524607e5e3e9ceab4a4c1d06c9d59b867be4899eacf`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/ensure_world_atlas_root-1.sql](effective-sql/ensure_world_atlas_root-1.sql); SHA-256 `40b8b46cc561348f0813a229c327e66df567961d5c9d40981cdb0717362c8c6c`.

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
| 41 | unbedingt | `public.list_world_atlas_maps(p_world_profile_id, false, NULL)` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `engine`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |

## Transaktion, Idempotenz und Folgewirkungen

- Potentieller Root-Insert und anschließende Liste innerhalb einer Transaktion; sequenzielle Wiederholung ist stabil.

**Direkt referenzierte reale Relationen:** `public.world_atlas_maps`, `public.world_maps`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.saga_asset_bindings`, `public.world_atlas_maps`, `public.world_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.ensure_world_atlas_root(uuid)` | INSERT | `public.world_atlas_maps` | world_profile_id, kind, title, generator_meta | v_id IS NULL |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_party_revealed_map_ids(uuid,uuid)` | [archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_resolve_saga_project(uuid,text)` | [archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | Keine eigene RAISE | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.list_world_atlas_maps(uuid,boolean,text)` | [archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql) | 22023, 42501 | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-atlas-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `ace9c6ff13acad2aefa17f25784225461551b5bf6a79e807c9a24786619a552b`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * world-atlas-service — Host HTTP for world atlas maps (CUT-20).
 * Location: src/infrastructure/world/world-atlas-service.ts
 */
import {
  parseWorldAtlasMapList,
  parseWorldAtlasMapVm,
  type WorldAtlasFeatureCollection,
  type WorldAtlasMapKind,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
  type WorldAtlasBounds,
} from '../../domains/world/atlas';
import {
  ensureHostWorldAtlasRoot,
  fetchHostWorldAtlasMap,
  isHostLibraryEnabled,
  listHostWorldAtlasMaps,
  publishHostWorldAsset,
  resolveHostWorldAssetUrl,
  upsertHostWorldAtlasMap,
} from '../host/host-world-http';

/** Azgaar .map / zip ceiling — aligned with host DEFAULT_ASSET_MAX_BYTES. */
const AZGAAR_MAX_BYTES = 16 * 1024 * 1024;

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export type UpsertWorldAtlasMapInput = {
  readonly worldProfileId: string;
  readonly mapId?: string | null;
  readonly parentMapId?: string | null;
  readonly kind: WorldAtlasMapKind;
  readonly title: string;
  readonly sortOrder?: number;
  readonly bounds: WorldAtlasBounds;
  readonly layers: WorldAtlasFeatureCollection;
  readonly basemapStoragePath?: string | null;
  readonly azgaarMapStoragePath?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>>;
  readonly expectedRevision?: number | null;
};

class WorldAtlasService {
  async listMaps(
    worldProfileId: string,
    options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
  ): Promise<WorldAtlasMapSummary[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldAtlasMaps(id, options);
    return parseWorldAtlasMapList(data);
  }

  async ensureRoot(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await ensureHostWorldAtlasRoot(id);
    return parseWorldAtlasMapList(data);
  }

  async getMap(
    mapId: string,
    playerView = false,
    sagaPublicId?: string | null,
  ): Promise<WorldAtlasMapVm> {
    assertHost();
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    const data = await fetchHostWorldAtlasMap(id, playerView, sagaPublicId);
    return parseWorldAtlasMapVm(data);
  }

  async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
    assertHost();
    const data = await upsertHostWorldAtlasMap({
      worldProfileId: input.worldProfileId.trim(),
      mapId: input.mapId ?? null,
      parentMapId: input.parentMapId ?? null,
      kind: input.kind,
      title: input.title,
      sortOrder: input.sortOrder ?? 0,
      bounds: input.bounds,
      layers: input.layers,
      basemapStoragePath: input.basemapStoragePath ?? null,
      azgaarMapStoragePath: input.azgaarMapStoragePath ?? null,
      generatorMeta: input.generatorMeta ?? {},
      expectedRevision: input.expectedRevision ?? null,
    });
    return parseWorldAtlasMapVm(data);
  }

  /**
   * CUT-10b (#1161): Azgaar .map/.zip via world-scoped host assets (world.edit).
   * Returns owner-scoped storagePath for azgaarMapStoragePath persistence.
   */
  async uploadAzgaarMapFile(worldProfileId: string, file: File): Promise<string> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (file.size <= 0) throw new Error('Azgaar-Datei ist leer.');
    if (file.size > AZGAAR_MAX_BYTES) {
      throw new Error('Azgaar-Datei ist zu groß. Maximum 16 MB');
    }
    const published = await publishHostWorldAsset(id, file, 'azgaar');
    return published.storagePath;
  }

  /**
   * CUT-10b (#1161): credentialed host asset URL successor of Storage signed URL.
   * Cookie media GET on /api/v1/assets/:id — expiresSec retained for API parity only.
   */
  async 
```

## Konkrete Abnahmekriterien

- [ ] Welt mit vorhandener Atlas-Wurzel wird ohne zusätzliche Wurzel zurückgegeben.
- [ ] Welt ohne Atlas mit bzw. ohne Legacy-Karte erzeugt den jeweils dokumentierten Root-Kind.
- [ ] Wiederholter Aufruf behält Root-ID; parallele Erstanlage auf Unique-/Lock-Verhalten prüfen.
- [ ] Player und Projekt-GM ohne Welt-Ownership42501; Rückgabe als Map-Summary-Liste decodieren.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [archive/supabase-legacy/supabase/migrations/001_initial.sql](../../../archive/supabase-legacy/supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [archive/supabase-legacy/supabase/migrations/004_project_membership_security.sql](../../../archive/supabase-legacy/supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [archive/supabase-legacy/supabase/migrations/008_world_profiles.sql](../../../archive/supabase-legacy/supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [archive/supabase-legacy/supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../archive/supabase-legacy/supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql](../../../archive/supabase-legacy/supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql](../../../archive/supabase-legacy/supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql](../../../archive/supabase-legacy/supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [archive/supabase-legacy/supabase/migrations/068_world_maps.sql](../../../archive/supabase-legacy/supabase/migrations/068_world_maps.sql) | `5898195600f2fc10330b1444cb288da5d58c59b5373058fa7a5923dfb123fe43` |
| [archive/supabase-legacy/supabase/migrations/075_saga_permission_grants.sql](../../../archive/supabase-legacy/supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql](../../../archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [archive/supabase-legacy/supabase/migrations/094_world_atlas.sql](../../../archive/supabase-legacy/supabase/migrations/094_world_atlas.sql) | `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058` |
| [archive/supabase-legacy/supabase/migrations/095_donalu_world_places.sql](../../../archive/supabase-legacy/supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [archive/supabase-legacy/supabase/migrations/101_world_places_select_editor_only.sql](../../../archive/supabase-legacy/supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [archive/supabase-legacy/supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../archive/supabase-legacy/supabase/migrations/102_world_atlas_player_redaction_force.sql) | `a1add570f090c4b8cae03170cf5b73bc7eba6ccc2a0f785d3d1910d0a3178bb3` |
| [archive/supabase-legacy/supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../archive/supabase-legacy/supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql](../../../archive/supabase-legacy/supabase/migrations/105_atlas_worldbuilder_player_projection.sql) | `8ab33d4d6ace74d129350524607e5e3e9ceab4a4c1d06c9d59b867be4899eacf` |
| [archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
| [src/infrastructure/world/world-atlas-service.ts](../../../src/infrastructure/world/world-atlas-service.ts) | `ace9c6ff13acad2aefa17f25784225461551b5bf6a79e807c9a24786619a552b` |
