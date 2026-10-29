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

### src/infrastructure/npc-creature/npc-creature-service.ts:389

AST-Auflösung: `string-literal`; SHA-256 `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
export async function spawnNpcCreatureInstance(input: {
  projectId: string;
  sessionId?: string | null;
  definitionId: string;
  instanceKind: NpcCreatureInstanceKind;
  displayName?: string | null;
  activeMemberUserIds: readonly string[];
}): Promise<NpcCreatureInstance> {
  const actorUserId = await getAuthenticatedUserId();
  const definition = await resolveDefinitionForInstance(input.definitionId);
  if (!definition) {
    throw new Error('Figuren-Vorlage wurde nicht gefunden.');
  }

  const existing = await listNpcCreatureInstances(input.projectId);
  const definitionReadable =
    isBuiltinOrCoreDefinitionId(definition.id)
    || Boolean(await supabaseNpcCreatureRepository.getDefinitionById(definition.id));

  const planned = planNpcCreatureInstanceSpawn(
    definition,
    {
      projectId: input.projectId,
      sessionId: input.sessionId ?? null,
      definitionId: input.definitionId,
      instanceKind: input.instanceKind,
      displayName: input.displayName ?? null,
    },
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
      existingInstances: existing,
      definitionReadable,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('spawn_npc_creature_instance', {
      p_project_id: planned.instance.projectId,
      p_definition_id: planned.instance.definitionId,
      p_instance_kind: planned.instance.instanceKind,
      p_snapshot: toInstanceSnapshotPayload(planned.instance.snapshot),
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
      p_display_name: planned.instance.displayName,
      p_sequence_number: planned.instance.sequenceNumber,
      p_session_id: planned.instance.sessionId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz konnte nicht erzeugt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz konnte nicht erzeugt werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Instanz konnte nicht erzeugt werden.');
  }
  return toNpcCreatureInstance(data as NpcCreatureInstanceRow);
}
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `NpcCreatureInstanceRow` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 13 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `asStringArray` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 28 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `parseSnapshot` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 33 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `parseRuntime` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 58 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `toNpcCreatureInstance` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 75 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `toInstanceRuntimePayload` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 91 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `toInstanceSnapshotPayload` | [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | 102 | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `INSTANCES_TABLE` | [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | 54 | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| `resolveDefinitionForInstance` | [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | 305 | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| `isBuiltinOrCoreDefinitionId` | [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | 316 | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| `listNpcCreatureInstances` | [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | 322 | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| `PersistedNpcCreatureScope` | [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | 18 | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `NpcCreatureDefinitionDto` | [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | 21 | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `NPC_CREATURE_DEFINITION_COLUMNS` | [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | 34 | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `mapNpcCreatureDefinitionRow` | [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | 41 | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `toPersistedNpcCreatureWrite` | [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | 60 | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `TABLE` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 32 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `SupabaseNpcCreatureRepository` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 34 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `UUID_PATTERN` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 289 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `assertUuid` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 291 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `scopeOfId` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 298 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `assertPersistedId` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 304 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `assertWritable` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 308 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `requireRecord` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 325 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `supabaseNpcCreatureRepository` | [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | 335 | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `getAuthenticatedUserId` | [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | 28 | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
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
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

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
| [src/infrastructure/npc-creature/npc-creature-instance.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature-instance.persistence.ts) | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| [src/infrastructure/npc-creature/npc-creature-service.ts](../../../src/infrastructure/npc-creature/npc-creature-service.ts) | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| [src/infrastructure/npc-creature/npc-creature.persistence.ts](../../../src/infrastructure/npc-creature/npc-creature.persistence.ts) | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| [src/infrastructure/npc-creature/supabase-npc-creature.repository.ts](../../../src/infrastructure/npc-creature/supabase-npc-creature.repository.ts) | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| [src/lib/authenticatedUser.ts](../../../src/lib/authenticatedUser.ts) | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| [src/lib/localAdmin.ts](../../../src/lib/localAdmin.ts) | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| [src/lib/networkTimeout.ts](../../../src/lib/networkTimeout.ts) | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
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
