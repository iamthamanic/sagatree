# RPC-Vertrag: `get_world_map`

Liest die Legacy-Tile-Weltkarte; der bestehende Player-Filter lässt sich per RPC-Flag umgehen.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#861](https://github.com/iamthamanic/sagatree/issues/861) — RPC-WORLD-MAP; Koordinator [#813](https://github.com/iamthamanic/sagatree/issues/813).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Ohne world_maps-Zeile: worldProfileId,revision=0,mapData={size:24,tiles:{},countries:[],pins:[]},updatedAt=NULL.
- Vorhandene Karte liefert map_data und Revision. Nur p_player_view=true filtert Pins mit discovered=false; fehlendes discovered wird als sichtbar behandelt.
- Legacy erzwingt den Filter nicht für Nicht-Editoren. Sicherer Nachfolger muss seine Player-Projektion aus Berechtigungen ableiten.

## Berechtigungen

- Authentifizierung und current_user_can_read_world_profile: Welt-Owner oder GM/aktives Mitglied eines an die Welt gebundenen Projekts.

## SQL-Signatur 1

`public.get_world_map(uuid,boolean)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_world_profile_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_player_view | `boolean` | DEFAULT | `FALSE` |

**RETURNS:** `jsonb`.

**Wirksame Definition:** [archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql) (Zeilen 104–169, SHA-256 `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/get_world_map-1.sql](effective-sql/get_world_map-1.sql); SHA-256 `b53d1111bca08ccdda3b79d3da1bcd00d18da4841aa8ac1624fa218b1fc60edf`.

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
| 24 | NOT FOUND | `jsonb_build_object(       'worldProfileId', p_world_profile_id,       'revision', 0,       'mapData', jsonb_build_object(         'size', 24,         'tiles', '{}'::jsonb,         'countries', '[]'::jsonb,         'pins', '[]'::jsonb       ),       'updatedAt', NULL     )` |
| 46 | unbedingt | `jsonb_build_object(     'worldProfileId', v_row.world_profile_id,     'revision', v_row.revision,     'mapData', v_data,     'updatedAt', v_row.updated_at   )` |

Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.

- `size`, `tiles`, `countries`, `pins`
- `worldProfileId`, `revision`, `mapData`, `updatedAt`

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| 42501 | not authenticated | — | v_user IS NULL |
| 22023 | world_profile_id required | — | p_world_profile_id IS NULL |
| 42501 | forbidden | — | NOT public.current_user_can_read_world_profile(p_world_profile_id) |

## Transaktion, Idempotenz und Folgewirkungen

- Reiner Lesevertrag; kein automatischer world_maps-Insert.

**Direkt referenzierte reale Relationen:** `public.world_maps`.

**Transitive reale Relationen:** `public.project_members`, `public.projects`, `public.world_maps`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_can_edit_world_profile(uuid)` | [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql](../../../archive/supabase-legacy/supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/world/world-map-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `c86e0c9b3d7242d33d5fb30f7496ba99bb7ccaa4b22abaa73c5edb072c50a828`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * world-map-service — Host HTTP for world maps (CUT-20).
 * Location: src/infrastructure/world/world-map-service.ts
 */
import {
  parseWorldMapVm,
  type WorldMapData,
  type WorldMapVm,
} from '../../domains/world/map';
import { fetchHostWorldMap, isHostLibraryEnabled, saveHostWorldMap } from '../host/host-world-http';

const MAP_PIN_MAX_BYTES = 5 * 1024 * 1024;
const MAP_PIN_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

/** Prepare pin image via map-pin optimizer. Never silent-fallback to original on failure. */
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind als Pin-Bild erlaubt.');
  }
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'map-pin',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!MAP_PIN_ALLOWED_MIME.has(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Pin-Bild-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Pin-Bild-Optimierung fehlgeschlagen.';
  throw new Error(message);
}

class WorldMapService {
  async getMap(worldProfileId: string, playerView = false): Promise<WorldMapVm> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await fetchHostWorldMap(id, playerView);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Kartenantwort');
    return vm;
  }

  async saveMap(
    worldProfileId: string,
    expectedRevision: number,
    mapData: WorldMapData,
  ): Promise<WorldMapVm> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await saveHostWorldMap(id, expectedRevision, mapData);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Speicherantwort');
    return vm;
  }

  /**
   * PARITY_MISSING (#1160): pin uploads use host asset flow in a later cutover.
   */
  async uploadPinImage(
    _worldProfileId: string,
    _file: File,
    _options?: UploadPinImageOptions,
  ): Promise<string> {
    void _worldProfileId;
    void _file;
    void _options;
    assertHost();
    throw new Error('Pin-Bild-Upload über Host-Speicher ist noch nicht verfügbar.');
  }
}

export const worldMapService = new WorldMapService();

```

## Konkrete Abnahmekriterien

- [ ] Leere Karte liefert die genaue Initialstruktur; gespeicherte Karte wird ohne ungewollte JSON-Umformung decodiert.
- [ ] Ein Player mit Welt-Leserecht kann im Nachfolger keinen undiscovered-Pin über p_player_view=false/NULL erhalten.
- [ ] Owner-Editor darf vollständige Karte lesen; true fordert auch für ihn eine gefilterte Vorschau an.
- [ ] Fremder Welt-Nutzer oder anon 42501; Lesen verändert weder Karte noch Revision.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### High — RPC-SEC-LEGACY-MAP-FLAG

Nicht-Editor mit Welt-Leserecht kann undiscovered Pins mit p_player_view=false lesen.

**Beleg:** archive/supabase-legacy/supabase/migrations/068_world_maps.sql: get_world_map filtert nur innerhalb IF p_player_view; current_user_can_read_world_profile erlaubt Projekt-Player.

**Erforderliche Nachfolger-Abnahme:** Player-Filter serverseitig anhand Editor-Recht erzwingen; true/false/NULL als Player prüfen. Unsicheren Legacy-Response nicht als Parität übernehmen.

**Isolierte Beobachtung:** [.qa/intake/rpc-contracts/legacy-observations.json](legacy-observations.json) / `BASELINE-SEC-LEGACY-MAP`. Eigene RPC-Reproduktion: True.

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
| [archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql](../../../archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql](../../../archive/supabase-legacy/supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
| [archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql](../../../archive/supabase-legacy/supabase/migrations/109_baseline_security_trust_boundaries.sql) | `4d4fe56b87341147a6324fd8b5a37de9b149dbc391f81c8046c9b8fa018bb26b` |
| [src/infrastructure/world/world-map-service.ts](../../../src/infrastructure/world/world-map-service.ts) | `c86e0c9b3d7242d33d5fb30f7496ba99bb7ccaa4b22abaa73c5edb072c50a828` |
