/**
 * npc-creature-service — app-facing facade for NPC/creature definition CRUD (#196),
 * world catalog availability (#199), promotion/controller (#200),
 * and adventure/session instances (#201).
 * App slices must not query tables directly.
 * Location: src/infrastructure/npc-creature/npc-creature-service.ts
 *
 * Dual-path (MIG-307): production remains Supabase repository/RPCs. Host ports are
 * bound via `createHostNpcCreatureAdapter` for tests / future cutover (no accidental
 * cutover — VITE host flags alone do not redirect this facade).
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
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import {
  toNpcControllerAssignment,
  type NpcControllerAssignmentRow,
} from './npc-creature-controller.persistence';
import {
  toInstanceRuntimePayload,
  toInstanceSnapshotPayload,
  toNpcCreatureInstance,
  type NpcCreatureInstanceRow,
} from './npc-creature-instance.persistence';
import { supabaseNpcCreatureRepository } from './supabase-npc-creature.repository';

const CONTROLLER_TABLE = 'npc_creature_controller_assignments';
const INSTANCES_TABLE = 'npc_creature_instances';

export async function listNpcCreatureDefinitions(options?: {
  scope?: NpcCreatureScope;
  worldProfileId?: string | null;
  includeArchived?: boolean;
}): Promise<NpcCreatureCatalogRecord[]> {
  return supabaseNpcCreatureRepository.listDefinitions(options);
}

export async function getNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord | null> {
  return supabaseNpcCreatureRepository.getDefinitionById(definitionId);
}

export async function createNpcCreatureDefinition(
  input: CreateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.createDefinition(input);
}

export async function updateNpcCreatureDefinition(
  input: UpdateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.updateDefinition(input);
}

export async function archiveNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.archiveDefinition(definitionId);
}

function personalCopyName(sourceName: string): string {
  const suffix = ' (Kopie)';
  const maxBase = Math.max(1, 255 - suffix.length);
  return `${sourceName.trim().slice(0, maxBase) || 'NPC'}${suffix}`;
}

/**
 * Clone any library definition into a new personal row with “(Kopie)” name.
 * Core/builtin sources are accepted from the in-memory catalog record (no DB row).
 */
export async function duplicateNpcCreatureDefinition(
  definitionId: string,
  sourceDefinition?: NpcCreatureDefinition,
): Promise<NpcCreatureCatalogRecord> {
  let definition = sourceDefinition ?? null;
  if (!definition) {
    const existing = await supabaseNpcCreatureRepository.getDefinitionById(definitionId);
    if (!existing) {
      throw new Error('Definition nicht gefunden.');
    }
    definition = existing.definition;
  }
  const { id: _id, scope: _scope, ...rest } = definition;
  return supabaseNpcCreatureRepository.createDefinition({
    target: { scope: 'personal' },
    draft: { ...rest, name: personalCopyName(rest.name) },
  });
}

export async function restoreNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.restoreDefinition(definitionId);
}

/** Library-ready summaries with derived Machtgrad labels. */
export function toNpcCreatureDefinitionSummaries(
  records: readonly NpcCreatureCatalogRecord[],
): NpcCreatureDefinitionSummary[] {
  return records.map((record) => {
    const derived = deriveNpcCreaturePower(record.definition);
    return {
      definition: record.definition,
      machtgradLabel: derived.machtgradLabel,
      status: record.status,
      scope: record.definition.scope,
      worldProfileId: record.worldProfileId,
    };
  });
}

/**
 * World-scoped definition authoring list (#199) — includes archived for restore UI.
 * Does not embed definitions into modules JSON.
 */
export async function loadWorldProfileNpcCreatureCatalog(
  worldProfileId: string,
): Promise<NpcCreatureCatalogRecord[]> {
  return supabaseNpcCreatureRepository.listDefinitions({
    scope: 'world',
    worldProfileId,
    includeArchived: true,
  });
}

export interface WorldNpcCreatureAvailability {
  config: NpcCreatureCatalogModuleConfig;
  resolved: ResolvedWorldNpcCreatureCatalog;
  worldRecords: NpcCreatureCatalogRecord[];
}

/**
 * Compose effective NPC/creature availability for a world profile (#199).
 * Includes the caller's active personal definitions when the module allows them.
 */
export async function loadWorldNpcCreatureAvailability(
  worldProfileId: string,
): Promise<WorldNpcCreatureAvailability> {
  const [modules, worldRecords, personalRecords] = await Promise.all([
    supabaseNpcCreatureRepository.loadWorldProfileModules(worldProfileId),
    loadWorldProfileNpcCreatureCatalog(worldProfileId),
    supabaseNpcCreatureRepository.listDefinitions({
      scope: 'personal',
      includeArchived: false,
    }),
  ]);
  const { config } = getNpcCreatureCatalogModuleConfig(modules);
  const worldDefinitions = worldRecords
    .filter((record) => record.status === 'active')
    .map((record) => record.definition);
  const personalDefinitions = personalRecords.map((record) => record.definition);

  const resolveDefinition = (
    definitionId: string,
  ): NpcCreatureDefinition | undefined => {
    const builtin = getBuiltinNpcCreatureDefinition(definitionId);
    if (builtin) return builtin;
    const core = getCoreNpcCreatureDefinition(definitionId);
    if (core) return core;
    const world = worldDefinitions.find((entry) => entry.id === definitionId);
    if (world) return world;
    return personalDefinitions.find((entry) => entry.id === definitionId);
  };

  const resolved = resolveWorldNpcCreatureCatalog({
    config,
    coreDefinitions: listCoreNpcCreatureDefinitions(),
    resolveDefinition,
    worldDefinitions,
    personalDefinitions,
  });

  return { config, resolved, worldRecords };
}

/**
 * Compact → Full (#200): flip sheetMode on the same definition id after a legal CharacterEditor save.
 */
export async function promoteNpcCreatureCompactToFull(input: {
  definitionId: string;
  fullSheet: Readonly<Record<string, unknown>>;
}): Promise<NpcCreatureCatalogRecord> {
  const attrsCheck = assertFullSheetHasNoSilentIllegalAttributes(input.fullSheet);
  if (attrsCheck.ok === false) {
    throw new Error(attrsCheck.message);
  }

  const existing = await supabaseNpcCreatureRepository.getDefinitionById(input.definitionId);
  if (!existing) {
    throw new Error('Figur wurde nicht gefunden.');
  }

  const draft = buildCompactToFullWriteDraft(existing.definition, input.fullSheet);
  if (!draft) {
    throw new Error('Compact→Full-Entwurf ungültig — Full Sheet fehlt oder ist leer.');
  }

  return supabaseNpcCreatureRepository.updateDefinition({
    definitionId: input.definitionId,
    draft,
  });
}

/** Load controller assignment for a campaign + definition (#200). */
export async function getNpcCreatureControllerAssignment(
  projectId: string,
  definitionId: string,
): Promise<NpcControllerAssignment | null> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from(CONTROLLER_TABLE)
      .select('project_id, definition_id, controller_user_id, assigned_by, updated_at')
      .eq('project_id', projectId)
      .eq('definition_id', definitionId)
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Controller-Zuweisung konnte nicht geladen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Controller-Zuweisung konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) return null;
  return toNpcControllerAssignment(data as NpcControllerAssignmentRow);
}

/**
 * Assign / clear controller via SECURITY DEFINER RPC (#200).
 * Domain plan runs first; server re-validates GM + membership.
 */
export async function assignNpcCreatureController(input: {
  projectId: string;
  definitionId: string;
  controllerUserId: string | null;
  activeMemberUserIds: readonly string[];
}): Promise<NpcControllerAssignment> {
  const actorUserId = await getAuthenticatedUserId();
  const record = await supabaseNpcCreatureRepository.getDefinitionById(input.definitionId);
  if (!record) {
    throw new Error('Figur wurde nicht gefunden.');
  }

  const planned = planNpcControllerAssignment(
    record.definition,
    {
      projectId: input.projectId,
      definitionId: input.definitionId,
      controllerUserId: input.controllerUserId,
    },
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('assign_npc_creature_controller', {
      p_project_id: planned.assignment.projectId,
      p_definition_id: planned.assignment.definitionId,
      p_controller_user_id: planned.assignment.controllerUserId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Controller konnte nicht zugewiesen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Controller konnte nicht zugewiesen werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Controller konnte nicht zugewiesen werden.');
  }
  return toNpcControllerAssignment(data as NpcControllerAssignmentRow);
}

async function resolveDefinitionForInstance(
  definitionId: string,
): Promise<NpcCreatureDefinition | null> {
  const builtin = getBuiltinNpcCreatureDefinition(definitionId);
  if (builtin) return builtin;
  const core = getCoreNpcCreatureDefinition(definitionId);
  if (core) return core;
  const record = await supabaseNpcCreatureRepository.getDefinitionById(definitionId);
  return record?.definition ?? null;
}

function isBuiltinOrCoreDefinitionId(definitionId: string): boolean {
  if (isCoreNpcCreatureDefinitionId(definitionId)) return true;
  return Boolean(getBuiltinNpcCreatureDefinition(definitionId));
}

/** List adventure instances for a project (#201). */
export async function listNpcCreatureInstances(
  projectId: string,
): Promise<NpcCreatureInstance[]> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from(INSTANCES_TABLE)
      .select(
        'id, project_id, session_id, definition_id, display_name, instance_kind, sequence_number, snapshot, runtime, created_by, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanzen konnten nicht geladen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanzen konnten nicht geladen werden: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => toNpcCreatureInstance(row as NpcCreatureInstanceRow));
}

/**
 * Spawn an adventure/session instance from a readable definition (#201).
 * Snapshot is frozen at spawn; later definition edits do not rewrite it.
 */
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

/** Update instance runtime only — snapshot stays frozen (#201). */
export async function updateNpcCreatureInstanceRuntime(input: {
  instance: NpcCreatureInstance;
  patch: NpcCreatureInstanceRuntimeUpdate;
  activeMemberUserIds: readonly string[];
}): Promise<NpcCreatureInstance> {
  const actorUserId = await getAuthenticatedUserId();
  const planned = planNpcCreatureInstanceRuntimeUpdate(
    input.instance,
    input.patch,
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('update_npc_creature_instance_runtime', {
      p_instance_id: planned.instance.id,
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz-Status konnte nicht gespeichert werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz-Status konnte nicht gespeichert werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Instanz-Status konnte nicht gespeichert werden.');
  }
  return toNpcCreatureInstance(data as NpcCreatureInstanceRow);
}

/** Remove an instance from the adventure (#201). Does not archive the definition. */
export async function removeNpcCreatureInstance(instanceId: string): Promise<void> {
  await getAuthenticatedUserId();
  const { error } = await raceWithTimeoutReject(
    supabase.rpc('remove_npc_creature_instance', {
      p_instance_id: instanceId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz konnte nicht entfernt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz konnte nicht entfernt werden: ${error.message}`);
  }
}

/**
 * Session end: clear temporary controllers on session-scoped instances only (#201).
 * Does not touch campaign controller assignments (#200).
 */
export async function clearNpcCreatureInstanceTempControllersForSession(
  sessionId: string,
): Promise<number> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('clear_npc_creature_instance_temp_controllers_for_session', {
      p_session_id: sessionId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Temporäre Controller konnten nicht zurückgesetzt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(
      `Temporäre Controller konnten nicht zurückgesetzt werden: ${error.message}`,
    );
  }
  return typeof data === 'number' ? data : 0;
}
