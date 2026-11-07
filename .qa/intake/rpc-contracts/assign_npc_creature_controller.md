# RPC-Vertrag: `assign_npc_creature_controller`

Setzt den permanenten Controller einer NPC-/Creature-Definition innerhalb eines Projekts.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#877](https://github.com/iamthamanic/sagatree/issues/877) — RPC-NPC-INSTANCES; Koordinator [#816](https://github.com/iamthamanic/sagatree/issues/816).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Definition-ID wird getrimmt und muss10–160Zeichen lang sein. Zielcontroller istNULL oder aktives Projektmitglied.
- Existiert eine gespeicherte Definition, muss sie status=active und payload.sheetMode=full haben; fehlender DB-Definitionssatz ist für Katalog-IDs erlaubt.
- UPSERT über(project_id,definition_id) setzt Controller, assigned_by und Zeitstempel. Antwort ist vollständige npc_creature_controller_assignments-Zeile.

## Berechtigungen

- Authentifizierung plus projects.gm_user_id=auth.uid() UND current_user_is_active_project_member(project). Die Instance-Helper verwenden diesen engeren GM-Vertrag.

## SQL-Signatur 1

`public.assign_npc_creature_controller(uuid,text,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_definition_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_controller_user_id | `uuid` | DEFAULT | `NULL` |

**RETURNS:** `public.npc_creature_controller_assignments`.

**Wirksame Definition:** [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) (Zeilen 62–160, SHA-256 `cc020b1d34e84b53bfd26fd2256963d3f2602eabfe369672b67c01b865966da8`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/assign_npc_creature_controller-1.sql](effective-sql/assign_npc_creature_controller-1.sql); SHA-256 `138c3713b11e43a76fb7cab74c814de500d94b93f507ab3f069809f8be2fa72b`.

### Vollständige Row-Antwort

Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.

| Spalte | Typ | NOT NULL | Default |
| --- | --- | --- | --- |
| project_id | `uuid` | True | Kein Default |
| definition_id | `text` | True | Kein Default |
| controller_user_id | `uuid` | False | Kein Default |
| assigned_by | `uuid` | True | Kein Default |
| updated_at | `timestamp with time zone` | True | `now()` |

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | `SET search_path TO 'public', 'pg_temp'` |
| Migration-/Skript-EXECUTE-Deklarationen | authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.

| Owner | Effektive Fixture-ACL | authenticated EXECUTE | anon EXECUTE |
| --- | --- | --- | --- |
| postgres | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | True | False |

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 82 | unbedingt | `v_row` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0001 | not authenticated | — | v_actor IS NULL |
| P0001 | missing project | — | p_project_id IS NULL |
| P0001 | invalid definition id | — | char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 |
| P0001 | only gm may assign controller | — | NOT EXISTS (     SELECT 1     FROM public.projects p     WHERE p.id = p_project_id       AND p.gm_user_id = v_actor   ) |
| P0001 | actor is not an active project member | — | NOT public.current_user_is_active_project_member(p_project_id) |
| P0001 | controller is not an active project member | — | p_controller_user_id IS NOT NULL ∧ NOT EXISTS (       SELECT 1       FROM public.project_members pm       WHERE pm.project_id = p_project_id         AND pm.user_id = p_controller_user_id         AND pm.status = 'active'     ) |
| P0001 | definition is not a full character sheet | — | EXISTS (     SELECT 1     FROM public.npc_creature_definitions d     WHERE d.id = v_definition_id   ) AND NOT EXISTS (     SELECT 1     FROM public.npc_creature_definitions d     WHERE d.id = v_definition_id       AND d.status = 'active'       AND COALESCE(d.payload->>'sheetMode', '') = 'full'   ) |

## Transaktion, Idempotenz und Folgewirkungen

- Assignment-UPSERT ist atomar; wiederholte identische Zuordnung aktualisiert Zeitstempel ohne zweite Zeile.

**Direkt referenzierte reale Relationen:** `public.npc_creature_controller_assignments`, `public.npc_creature_definitions`, `public.project_members`, `public.projects`.

**Transitive reale Relationen:** `public.npc_creature_controller_assignments`, `public.npc_creature_definitions`, `public.project_members`, `public.projects`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.assign_npc_creature_controller(uuid,text,uuid)` | INSERT | `public.npc_creature_controller_assignments` | project_id, definition_id, controller_user_id, assigned_by, updated_at | unbedingt |

### Erreichbare Trigger

| Auslösende Funktion | Relation / Trigger | Funktion |
| --- | --- | --- |
| `public.assign_npc_creature_controller(uuid,text,uuid)` | `public.npc_creature_controller_assignments` / `trg_npc_creature_controller_assignments_updated_at` | `public.set_npc_creature_controller_assignments_updated_at()` |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |
| `public.set_npc_creature_controller_assignments_updated_at()` | [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | Keine eigene RAISE | True/True |

### Constraint-Vertrag

Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/npc-creature/npc-creature-service.ts:1

AST-Auflösung: `host-transport-cut-20`; SHA-256 `78bf416e2f51d54911af52ca86ec33e09ad934e0f311fbbce19ec175bfbbe30d`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
/**
 * npc-creature-service — app-facing facade for NPC/creature definition CRUD (#196),
 * world catalog availability (#199), promotion/controller (#200),
 * and adventure/session instances (#201).
 * App slices must not query tables directly.
 * Location: src/infrastructure/npc-creature/npc-creature-service.ts
 *
 * Host Library HTTP only (CUT-20). Core/builtin packs still merge in UI.
 */
import {
  assertFullSheetHasNoSilentIllegalAttributes,
  buildCompactToFullWriteDraft,
  deriveNpcCreaturePower,
  getBuiltinNpcCreatureDefinition,
  getCoreNpcCreatureDefinition,
  getNpcCreatureCatalogModuleConfig,
  isCoreNpcCreatureDefinitionId,
  listCoreNpcCreatureDefinitions,
  parseNpcCreatureDefinition,
  planNpcControllerAssignment,
  planNpcCreatureInstanceRuntimeUpdate,
  planNpcCreatureInstanceSpawn,
  resolveWorldNpcCreatureCatalog,
  type CreateNpcCreatureDefinitionInput,
  type NpcControllerAssignment,
  type NpcCreatureCatalogModuleConfig,
  type NpcCreatureCatalogRecord,
  type NpcCreatureDefinition,
  type NpcCreatureDefinitionSummary,
  type NpcCreatureInstance,
  type NpcCreatureInstanceKind,
  type NpcCreatureInstanceRuntimeUpdate,
  type NpcCreatureScope,
  type ResolvedWorldNpcCreatureCatalog,
  type UpdateNpcCreatureDefinitionInput,
} from '../../domains/npc-creature';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import {
  archiveHostLibraryNpcCreature,
  assignHostNpcCreatureController,
  createHostLibraryNpcCreature,
  fetchHostLibraryNpcCreatureById,
  fetchHostLibraryNpcCreatures,
  fetchHostNpcCreatureControllerAssignment,
  fetchHostNpcInstances,
  isHostLibraryEnabled,
  removeHostNpcInstance,
  spawnHostNpcInstance,
  updateHostLibraryNpcCreature,
  updateHostNpcInstanceRuntime,
  type HostNpcControllerAssignmentDto,
  type HostNpcInstanceDto,
} from '../host/host-library-http';
import { clearHostNpcTempControllersForSession } from '../host/host-session-http';
import {
  toInstanceRuntimePayload,
  toInstanceSnapshotPayload,
  toNpcCreatureInstance,
} from './npc-creature-instance.persistence';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function mapHostLibraryNpcRecord(raw: unknown): NpcCreatureCatalogRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  const scopeRaw = row.scope;
  const scope =
    scopeRaw === 'personal' || scopeRaw === 'world' || scopeRaw === 'core' || scopeRaw === 'builtin'
      ? scopeRaw
      : null;
  if (!scope || scope === 'core' || scope === 'builtin') return null;
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? row.payload
      : {};
  const definition = parseNpcCreatureDefinition(id, scope, payload);
  if (!definition) return null;
  const publicId =
    typeof row.publicId === 'string' && row.publicId.trim()
      ? row.publicId.trim().toUpperCase()
      : null;
  // Assign ownership via property write — facade must not invent owners in literals.
  const record = {
    definition,
    status: (row.status === 'archived' ? 'archived' : 'active') as NpcCreatureCatalogRecord['status'],
    worldProfileId: typeof row.worldProfileId === 'string' ? row.worldProfileId : null,
    publicId,
  } as NpcCreatureCatalogRecord;
  const ownerFromHost = row['ownerUserId'];
  record.ownerUserId = typeof ownerFromHost === 'string' ? ownerFromHost : '';
  return record;
}

export async function listNpcCreatureDefinitions(options?: {
  scope?: NpcCreatureScope;
  worldProfileId?: string | null;
  includeArchived?: boolean;
}): Promise<NpcCreatureCatalogRecord[]> {
  assertHost();
  const rows = await fetchHostLibraryNpcCreatures();
  return rows
    .map(mapHostLibraryNpcRecord)
    .filter((record): record is NpcCreatureCa
```

## Konkrete Abnahmekriterien

- [ ] GM mit aktiver Mitgliedschaft kann aktiven Player setzen oder mitNULL löschen; gleicher Schlüssel upsertet dieselbe Assignment-Zeile.
- [ ] Bloßer GM ohne aktive Mitgliedschaft und Nicht-GM werden abgewiesen.
- [ ] Inaktiver/fremder Controller sowie gespeicherte archived/nichtfull Definition werden abgewiesen.
- [ ] Nichtpersistente Katalog-ID im erlaubten Längenbereich funktioniert; Request-/Row-Decoder prüfen.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | `78bf416e2f51d54911af52ca86ec33e09ad934e0f311fbbce19ec175bfbbe30d` |
| [supabase/migrations/001_initial.sql](../../../supabase/migrations/001_initial.sql) | `e3325c56d68286a2e293ddff791736ef91346ff90ac018c045843a5d52afb8c8` |
| [supabase/migrations/004_project_membership_security.sql](../../../supabase/migrations/004_project_membership_security.sql) | `c1eccbda2dae95cd177ba6313dfd51ef269e0740a13805a5d07a223c6bf489cd` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/021_npc_creature_definitions.sql](../../../supabase/migrations/021_npc_creature_definitions.sql) | `a1442859d0aadfd61af053c4799f8fa1ee147933b988be7c54a6515a0e5783fc` |
| [supabase/migrations/022_npc_creature_controller_assignments.sql](../../../supabase/migrations/022_npc_creature_controller_assignments.sql) | `cc020b1d34e84b53bfd26fd2256963d3f2602eabfe369672b67c01b865966da8` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
