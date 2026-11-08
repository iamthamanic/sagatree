# RPC-Vertrag: `delete_world_node`

Entfernt bestätigten Weltteilbaum, löst Saga-Ortsreferenzen und löscht dessen verknüpfte Nicht-Weltkarten.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#866](https://github.com/iamthamanic/sagatree/issues/866) — RPC-WORLD-DESTRUCTIVE; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Berechnet Vorschau und verlangt p_confirm=true, wenn Kinder/Bindings betroffen sind.
- Sammelt alle Karten sämtlicher Links des Teilbaums. Setzt saga_asset_bindings.world_place_id=NULL, löscht Teilbaumlinks und Orte und anschließend gesammelte Karten, deren kind nicht world ist.
- Antwort deletedCount,placeIds,consequences. Bestehende Saga-Binding-Zeilen selbst bleiben bestehen.
- Gemeinsam mit Außenorten verknüpfte Karten werden im Legacy nicht separat geschützt; dieser Konsequenzfall muss vor Übernahme ausdrücklich geklärt werden.

## Berechtigungen

- Authentifizierung und current_user_can_edit_world_profile: ausschließlich world_profiles.owner_user_id=auth.uid(); Projekt-GM ohne Ownership erhält keine Welt-Schreibrechte.

## SQL-Signatur 1

`public.delete_world_node(uuid,uuid,boolean)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_place_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_confirm | `boolean` | DEFAULT | `FALSE` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql) (Zeilen 420–485, SHA-256 `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/delete_world_node-1.sql](effective-sql/delete_world_node-1.sql); SHA-256 `abee6c7c3200023966b09332e2030a4d4e285400bdaa45e2ee94b47f0b3ac950`.

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
| 47 | unbedingt | `jsonb_build_object(     'deletedCount', v_n,     'placeIds', to_jsonb(v_ids),     'consequences', v_preview   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `deletedCount`, `placeIds`, `consequences`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | auth.uid() IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_edit_world_profile(p_world_profile_id) |
| 22023 | confirmation required | — | (v_preview->>'requiresConfirm')::BOOLEAN IS TRUE AND p_confirm IS NOT TRUE |

## Transaktion, Idempotenz und Folgewirkungen

- Binding-Detach, Link-/Orts-/Karten-Delete und FK-/Triggerfolgen sind atomar. Zweiter Aufruf auf gelöschten Ort ist Fehler, kein gecachter Erfolg.

**Direkt referenzierte reale Relationen:** `public.saga_asset_bindings`, `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`.

**Transitive reale Relationen:** `public.saga_asset_bindings`, `public.world_atlas_maps`, `public.world_place_map_links`, `public.world_places`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.delete_world_node(uuid,uuid,boolean)` | UPDATE | `public.saga_asset_bindings` | world_place_id, updated_at | unbedingt |
| `public.delete_world_node(uuid,uuid,boolean)` | DELETE | `public.world_place_map_links` | — | unbedingt |
| `public.delete_world_node(uuid,uuid,boolean)` | DELETE | `public.world_places` | — | unbedingt |
| `public.delete_world_node(uuid,uuid,boolean)` | DELETE | `public.world_atlas_maps` | — | cardinality(v_maps) > 0 |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.atlas_wb_descendant_ids(uuid,uuid)` | [archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql) | Keine eigene RAISE | True/True |
| `public.atlas_wb_place_row(uuid,uuid)` | [archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql) | P0002 | True/True |
| `public.current_user_can_edit_world_profile(uuid)` | [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.preview_world_node_consequences(uuid,uuid)` | [archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql) | 42501 | False/True |

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

- [ ] Bestätigter Teilbaum wird vollständig entfernt; Saga-Binding-Zeilen bleiben mit NULL-Ortsreferenz bestehen.
- [ ] Weltwurzelkarten mit kind=world bleiben erhalten; Nicht-Weltkarten aus Teilbaumlinks werden entfernt.
- [ ] Fehlende erforderliche Bestätigung22023 und Nicht-Owner42501 lassen alle Beziehungen unverändert.
- [ ] Mit außenstehendem Ort gemeinsam genutzte Karte darf im sicheren Zielvertrag nicht unbeabsichtigt dessen Links verlieren; Scope/Bestätigung dafür explizit abnehmen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Medium — RPC-DATA-SHARED-MAP-DELETE

Die Kartenlöschung umfasst jede Karte eines Teilbaumlinks, auch bei weiteren Links außerhalb des Teilbaums.

**Beleg:** archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql: delete_world_node sammelt map_id ohne Exklusivitätsbedingung und löscht gesammelte Nicht-world-Karten.

**Erforderliche Nachfolger-Abnahme:** Gemeinsam genutzte Karten/FK-Cascades mit Außenort-Fixture prüfen und eine explizite Erhaltungs- oder Bestätigungsregel festlegen; keine unbemerkte Datenverlust-Parität.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [archive/supabase-legacy/supabase/migrations/008_world_profiles.sql](../../../archive/supabase-legacy/supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [archive/supabase-legacy/supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../archive/supabase-legacy/supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [archive/supabase-legacy/supabase/migrations/075_saga_permission_grants.sql](../../../archive/supabase-legacy/supabase/migrations/075_saga_permission_grants.sql) | `1352ed1aa5bba73e5f25d4fffc1798789b689240874b18ebd856042455aeb632` |
| [archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql](../../../archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [archive/supabase-legacy/supabase/migrations/094_world_atlas.sql](../../../archive/supabase-legacy/supabase/migrations/094_world_atlas.sql) | `1a329c3ee211351e2630d810ff94ad23ef9ae7424bec0f58ab0acefdbb19b058` |
| [archive/supabase-legacy/supabase/migrations/095_donalu_world_places.sql](../../../archive/supabase-legacy/supabase/migrations/095_donalu_world_places.sql) | `797acda3420a38b709aeeffb289ef8dfee980ba9241f44c168c157cc5c85390f` |
| [archive/supabase-legacy/supabase/migrations/101_world_places_select_editor_only.sql](../../../archive/supabase-legacy/supabase/migrations/101_world_places_select_editor_only.sql) | `9c64d983108e36ea19d6acef12723ca006ca31a663fd15a3a34db893cfa0abf0` |
| [archive/supabase-legacy/supabase/migrations/102_world_atlas_player_redaction_force.sql](../../../archive/supabase-legacy/supabase/migrations/102_world_atlas_player_redaction_force.sql) | `a1add570f090c4b8cae03170cf5b73bc7eba6ccc2a0f785d3d1910d0a3178bb3` |
| [archive/supabase-legacy/supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql](../../../archive/supabase-legacy/supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql) | `84afa7b42fab766cf5114c65aefd433b856a173e1065f7e34f4fc10875ee784d` |
| [archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql](../../../archive/supabase-legacy/supabase/migrations/104_atlas_worldbuilder_mutations.sql) | `faefcc47bcddd1647c38971b4efbdb5a3cd064c76cbaca5f02a644ebe9e31f90` |
| [src/infrastructure/world/world-place-service.ts](../../../src/infrastructure/world/world-place-service.ts) | `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb` |
