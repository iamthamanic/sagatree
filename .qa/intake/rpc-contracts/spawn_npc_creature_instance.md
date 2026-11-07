# RPC-Vertrag: `spawn_npc_creature_instance`

Erzeugt eine projektbezogene generische oder persistente NPC-Instanz mit unveränderlichem Ausgangs-Snapshot.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#877](https://github.com/iamthamanic/sagatree/issues/877) — RPC-NPC-INSTANCES; Koordinator [#816](https://github.com/iamthamanic/sagatree/issues/816).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- Definition10–160Zeichen, display_name1–120, sequence_number>=1, snapshot undruntime alsJSON-Objekte. instance_kind generic/persistent.
- Persistent darf keine Session binden; optionale Generic-Session muss zum Projekt gehören.
- personal:/world:-Definitionen müssen existieren und für den Actor lesbar sein, auch archivierte bestehende Definitionen sind erlaubt; core:/builtin:-IDs können Snapshot-only sein.
- Nichtleere string temporaryControllerUserId muss UUID eines aktiven Projektmitglieds sein. Antwort ist vollständige npc_creature_instances-Zeile.

## Berechtigungen

- Authentifizierung plus projects.gm_user_id=auth.uid() UND current_user_is_active_project_member(project). Die Instance-Helper verwenden diesen engeren GM-Vertrag.

## SQL-Signatur 1

`public.spawn_npc_creature_instance(uuid,text,text,jsonb,jsonb,text,integer,uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| p_project_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_definition_id | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_instance_kind | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_snapshot | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_runtime | `jsonb` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_display_name | `text` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_sequence_number | `integer` | DEFAULT | Kein Default — expliziter Wert erforderlich |
| p_session_id | `uuid` | DEFAULT | `NULL` |

**RETURNS:** `public.npc_creature_instances`.

**Wirksame Definition:** [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) (Zeilen 128–259, SHA-256 `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/spawn_npc_creature_instance-1.sql](effective-sql/spawn_npc_creature_instance-1.sql); SHA-256 `b961d3842b0440dbcb1d63c834660758dd7733f63f53aae9fd19c05a0e1f56c6`.

### Vollständige Row-Antwort

Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.

| Spalte | Typ | NOT NULL | Default |
| --- | --- | --- | --- |
| id | `uuid` | True | `gen_random_uuid()` |
| project_id | `uuid` | True | Kein Default |
| session_id | `uuid` | False | Kein Default |
| definition_id | `text` | True | Kein Default |
| display_name | `text` | True | Kein Default |
| instance_kind | `text` | True | Kein Default |
| sequence_number | `integer` | True | Kein Default |
| snapshot | `jsonb` | True | Kein Default |
| runtime | `jsonb` | True | Kein Default |
| created_by | `uuid` | True | Kein Default |
| created_at | `timestamp with time zone` | True | `now()` |
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
| 110 | unbedingt | `v_row` |

### Explizite SQL-Fehler dieses Overloads

| SQLSTATE | Meldung | Formatparameter | Bedingungspfad |
| --- | --- | --- | --- |
| P0001 | invalid definition id | — | char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 |
| P0001 | invalid instance kind | — | v_kind NOT IN ('generic', 'persistent') |
| P0001 | invalid display name | — | char_length(v_display_name) < 1 OR char_length(v_display_name) > 120 |
| P0001 | invalid sequence number | — | p_sequence_number IS NULL OR p_sequence_number < 1 |
| P0001 | invalid snapshot | — | jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' |
| P0001 | invalid runtime | — | jsonb_typeof(p_runtime) IS DISTINCT FROM 'object' |
| P0001 | persistent instances must not bind a session | — | v_kind = 'persistent' AND p_session_id IS NOT NULL |
| P0001 | session does not belong to project | — | p_session_id IS NOT NULL ∧ v_session_project IS NULL OR v_session_project IS DISTINCT FROM p_project_id |
| P0001 | definition not readable | — | v_definition_id LIKE 'personal:%' OR v_definition_id LIKE 'world:%' ∧ NOT EXISTS (       SELECT 1       FROM public.npc_creature_definitions d       WHERE d.id = v_definition_id         AND (           (d.scope = 'personal' AND d.owner_user_id = v_actor)           OR (d.scope = 'world' AND public.current_user_can_read_world_profile(d.world_profile_id))         )     ) |
| P0001 | temporary controller is not an active project member | — | p_runtime ? 'temporaryControllerUserId'      AND jsonb_typeof(p_runtime->'temporaryControllerUserId') = 'string'      AND btrim(p_runtime->>'temporaryControllerUserId') <> '' ∧ NOT EXISTS (       SELECT 1       FROM public.project_members pm       WHERE pm.project_id = p_project_id         AND pm.user_id = (p_runtime->>'temporaryControllerUserId')::uuid         AND pm.status = 'active'     ) |

## Transaktion, Idempotenz und Folgewirkungen

- Validierung und Instanz-Insert sind ein SQL-Aufruf; kein Idempotency-Key, Constraints definieren persistente Eindeutigkeit.

**Direkt referenzierte reale Relationen:** `public.npc_creature_definitions`, `public.npc_creature_instances`, `public.project_members`, `public.sessions`.

**Transitive reale Relationen:** `public.npc_creature_definitions`, `public.npc_creature_instances`, `public.project_members`, `public.projects`, `public.sessions`, `public.world_profiles`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| `public.spawn_npc_creature_instance(uuid,text,text,jsonb,jsonb,text,integer,uuid)` | INSERT | `public.npc_creature_instances` | project_id, session_id, definition_id, display_name, instance_kind, sequence_number, snapshot, runtime, created_by, created_at, updated_at | unbedingt |

### Delegierte Funktionen und Fehler

Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im [gemeinsamen Funktionskatalog](effective-functions.json).

| Helper | SQL-Quelle | Explizite SQLSTATEs | Fixture EXECUTE anon/authenticated |
| --- | --- | --- | --- |
| `public.assert_npc_creature_instance_gm(uuid)` | [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | P0001 | False/True |
| `public.current_user_can_read_world_profile(uuid)` | [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | Keine eigene RAISE | False/True |
| `public.current_user_is_active_project_member(uuid)` | [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | Keine eigene RAISE | False/True |

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

- [ ] Generic mit passender Session und Persistent ohneSession erzeugen korrekte Instanz/Snapshot/Runtime/Sequenz.
- [ ] Persistent mitSession, fremdeSession und unlesbare personal/world Definition werden ohne Insert abgewiesen.
- [ ] Grenzen10/160Definition,1/120Name, sequence0 und nichtobjektförmige Payloads prüfen; ungültiger ControllerUUID-Cast liefert den echten SQLSTATE.
- [ ] Nicht-GM bzw. GM ohne aktive Mitgliedschaft abgewiesen; archivierte lesbare Definitionsreferenz bleibt explizit erlaubt.

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
| [supabase/migrations/008_world_profiles.sql](../../../supabase/migrations/008_world_profiles.sql) | `94d2db4e86205d09d54b63e322af6b69b93a7e07d13f3795bc1d841a46961b1a` |
| [supabase/migrations/015_inventory_item_definitions.sql](../../../supabase/migrations/015_inventory_item_definitions.sql) | `aeedfd77bb79d7d38f4163a496b373d266027b39adbce82fe14aec768187e9e7` |
| [supabase/migrations/019_world_profiles_read_for_adventure.sql](../../../supabase/migrations/019_world_profiles_read_for_adventure.sql) | `fb3f7956d105413e1c779b891317eb8f6c199968f6eb23d8e2b72d7dc7b1bb10` |
| [supabase/migrations/021_npc_creature_definitions.sql](../../../supabase/migrations/021_npc_creature_definitions.sql) | `a1442859d0aadfd61af053c4799f8fa1ee147933b988be7c54a6515a0e5783fc` |
| [supabase/migrations/023_npc_creature_instances.sql](../../../supabase/migrations/023_npc_creature_instances.sql) | `36720ac8bf2973fae37ef3ab2fd5d8be7397d48ca1cb133b9a6e09a0d1b48008` |
| [supabase/migrations/039_public_resource_ids_and_session_numbers.sql](../../../supabase/migrations/039_public_resource_ids_and_session_numbers.sql) | `053f02aaea8e1f3af27bfa3f6c7e17caadd5d5434ef6298e11920d0891b55f96` |
| [supabase/migrations/040_session_join_code_security.sql](../../../supabase/migrations/040_session_join_code_security.sql) | `0f925ad01130c34b55bdc7304b2248e83f26c7e9f12bf75622fdfc22e87d6389` |
| [supabase/migrations/041_session_runtime_state.sql](../../../supabase/migrations/041_session_runtime_state.sql) | `620b4a236e944c1c77b4eb15ae310dca4c6a6cd2011e42047f445ad94d787cb6` |
| [supabase/migrations/050_session_adventure_runtime.sql](../../../supabase/migrations/050_session_adventure_runtime.sql) | `51fae34e30f92395dc8437f8194af45c422f67c91c403e00f747807b09fa75fc` |
| [supabase/migrations/052_projects_look_settings.sql](../../../supabase/migrations/052_projects_look_settings.sql) | `fd581588589e5d27c50bc8c97ab5478aa7b12d4d3ba081f367e752543fdb2488` |
| [supabase/migrations/053_sessions_look_override.sql](../../../supabase/migrations/053_sessions_look_override.sql) | `1ff74aba67dc024b7f7c080933e5cbb684c139f8532bf7d10bf13669c9e5647b` |
| [supabase/migrations/059_saga_state_column_privileges.sql](../../../supabase/migrations/059_saga_state_column_privileges.sql) | `218a09c923cc8880384355c8cefad15fb4a31d7b39cbd11d5531f5a433c58866` |
| [supabase/migrations/061_session_recaps_and_handover.sql](../../../supabase/migrations/061_session_recaps_and_handover.sql) | `be5ec785052294d9722fb0789032fbd62d845695d1c2bddeca7c60fe9e951921` |
| [supabase/migrations/063_saga_definitions.sql](../../../supabase/migrations/063_saga_definitions.sql) | `09e02b7347ee1f64bcac0e1ff18b2293fc169269e01264e9cdbf8c412fa53c89` |
| [supabase/migrations/083_world_profiles_public_id.sql](../../../supabase/migrations/083_world_profiles_public_id.sql) | `38b33710dcf628e7b834810e7dfd4dfacc97a0d23cc8673d76d96e2330bf6081` |
| [supabase/migrations/092_fix_projects_rls_recursion.sql](../../../supabase/migrations/092_fix_projects_rls_recursion.sql) | `8e98ae8e52beb6ab57359338e7b30bdc2db322b7cdb44bdbf4059a41ab26e1bd` |
