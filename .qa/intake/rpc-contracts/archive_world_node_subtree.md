# RPC-Vertrag: `archive_world_node_subtree`

Archiviert einen Weltort samt Nachfahren nach der erforderlichen Folgenbestätigung.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#866](https://github.com/iamthamanic/sagatree/issues/866) — RPC-WORLD-DESTRUCTIVE; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Ruft Vorschau auf; wenn requiresConfirm=true und p_confirm nichttrue,22023.
- Archiviert Wurzel und alle Nachfahren, erhöht deren Revisionen und erhält Karten/Bindings entsprechend dem tatsächlichen UPDATE-/Trigger-Vertrag.
- Antwort archivedCount,placeIds,consequences; placeIds umfasst auch Wurzel.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.archive_world_node_subtree(uuid,uuid,boolean)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_confirm | `boolean` | DEFAULT | `FALSE` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) (Zeilen 373–420, SHA-256 `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/archive_world_node_subtree-1.sql](effective-sql/archive_world_node_subtree-1.sql); SHA-256 `4688ebb9c4f4d3d35a2c451484055426e723a765b5e61aa786896c6207a5c16a`.

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
| 28 | unbedingt | `jsonb_build_object(     'archivedCount', v_n,     'placeIds', to_jsonb(v_ids),     'consequences', v_preview   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `archivedCount`, `placeIds`, `consequences`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | auth.uid() IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | confirmation required | — | (v_preview->>'requiresConfirm')::BOOLEAN IS TRUE AND p_confirm IS NOT TRUE |

## Transaktion, Idempotenz und Folgewirkungen

- Preview und Teilbaum-UPDATE sind ein SQL-Aufruf; Wiederholung kann Revisionen erneut erhöhen, also kein deduplizierter Effekt.

**Direkt referenzierte reale Relationen:** `public.world_places`.

**Transitive reale Relationen:** `public.saga_asset_bindings`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.archive_world_node_subtree(uuid,uuid,boolean)` | UPDATE | `public.world_places` | status, revision, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.archive_world_node_subtree(uuid,uuid,boolean)` | `public.world_places` / `trg_world_places_same_world` | `public.world_places_enforce_same_world()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_descendant_ids(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_place_row(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | P0002 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.preview_world_node_consequences(uuid,uuid)` | [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | 42501 | False/True |
| `public.world_places_enforce_same_world()` | [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | 23514 | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-place-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * world-place-service — Host HTTP for world_places + map links (CUT-20).
 * Location: src/infrastructure/world/world-place-service.ts
 */
import {
  isWorldPlaceMapUsage,
  parseWorldPlaceList,
  parseWorldPlaceMapLinkList,
  parseWorldPlaceMapLinkVm,
  parseWorldPlaceVm,
  type UpsertWorldPlaceInput,
  type WorldPlaceMapLinkVm,
  type WorldPlaceMapUsage,
  type WorldPlaceVm,
} from '../../domains/world/places';
import type { WorldNodeKind, WorldNodeSubtype } from '../../domains/world/hierarchy';
import {
  archiveHostWorldNodeSubtree,
  createHostWorldNodeWithMaps,
  deleteHostWorldNode,
  duplicateHostWorldNode,
  isHostLibraryEnabled,
  listHostWorldPlaceMapLinks,
  listHostWorldPlaces,
  previewHostWorldNodeConsequences,
  renameHostWorldNode,
  reparentHostWorldNode,
  upsertHostWorldPlace,
  upsertHostWorldPlaceMapLink,
} from '../host/host-world-http';

export type ListWorldPlacesOptions = {
  readonly playerView?: boolean;
  readonly sagaPublicId?: string | null;
};

export type LinkWorldPlaceMapInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId?: string | null;
  readonly anchor?: Readonly<Record<string, unknown>>;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class WorldPlaceService {
  async listPlaces(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceVm[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldPlaces(id, options);
    return parseWorldPlaceList(data);
  }

  async listMapLinks(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceMapLinkVm[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldPlaceMapLinks(id, options);
    return parseWorldPlaceMapLinkList(data);
  }

  async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
    assertHost();
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

  async createNodeWithMaps(input: {
    readonly worldProfileId: string;
    readonly kind: WorldNodeKind;
    readonly name: string;
    readonly idempotencyKey: string;
    readonly subtype?: WorldNodeSubtype | null;
    readonly parentPlaceId?: string | null;
    readonly description?: string | null;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await createHostWorldNodeWithMaps({
      worldProfileId: input.worldProfileId.trim(),
      kind: input.kind,
      name: input.name,
      idempotencyKey: input.idempotencyKey.trim(),
      subtype: input.subtype ?? null,
      parentPlaceId: input.parentPlaceId ?? null,
      description: input.description ?? null,
    });
    if (!data || typeof data !== 'object') {
      throw new Error('Weltknoten anlegen: ungültige Antwort');
    }
    return data as Readonly<Record<string, unknown>>;
  }

  async previewNodeConsequences(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await previewHostWorldNodeConsequences({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
    });
    if (!data ||
```

## Konkrete Abnahmekriterien

- [ ] Bestätigte Archivierung setzt genau Teilbaum-Orte auf archived und erhöht deren Revisionen.
- [ ] Abhängiger Teilbaum ohne Bestätigung22023; kein Kind wird vorher archiviert.
- [ ] Unabhängiger Blattort kann ohne Bestätigung nach dokumentierter Preview-Regel archiviert werden.
- [ ] Fremde Welt/Owner-Verstoß42501; Wiederholung und daraus folgende Listenausblendung exakt prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb` |
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/075_saga_permission_grants.sql](../../../supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/095_donalu_world_places.sql](../../../supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [supabase/migrations/101_world_places_select_editor_only.sql](../../../supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../supabase/migrations/104_atlas_worldbuilder_mutations.sql) | `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90` |
