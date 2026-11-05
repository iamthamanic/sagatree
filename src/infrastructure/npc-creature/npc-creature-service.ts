/**
 * npc-creature-service — app-facing facade for NPC/creature definition CRUD (#196),
 * world catalog availability (#199), promotion/controller (#200),
 * and adventure/session instances (#201).
 * App slices must not query tables directly.
 * Location: src/infrastructure/npc-creature/npc-creature-service.ts
 *
 * Dual-path (FE-HOST-05): Host Library when `VITE_SAGATREE_HOST_LIBRARY=1` —
 * list + create/update/archive via host HTTP; Core/builtin packs still merge in UI.
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
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import {
  archiveHostLibraryNpcCreature,
  assignHostNpcCreatureController,
  createHostLibraryNpcCreature,
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

const CONTROLLER_TABLE = 'npc_creature_controller_assignments';
const INSTANCES_TABLE = 'npc_creature_instances';

export async function listNpcCreatureDefinitions(options?: {
  scope?: NpcCreatureScope;
  worldProfileId?: string | null;
  includeArchived?: boolean;
}): Promise<NpcCreatureCatalogRecord[]> {
  if (isHostLibraryEnabled()) {
    const rows = await fetchHostLibraryNpcCreatures();
    return rows
      .map(mapHostLibraryNpcRecord)
      .filter((record): record is NpcCreatureCatalogRecord => record !== null)
      .filter((record) => {
        if (options?.includeArchived) return true;
        return record.status === 'active';
      })
      .filter((record) => {
        if (!options?.scope) return true;
        return record.definition.scope === options.scope;
      })
      .filter((record) => {
        if (!options?.worldProfileId) return true;
        return record.worldProfileId === options.worldProfileId;
      });
  }
  return supabaseNpcCreatureRepository.listDefinitions(options);
}

export async function getNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord | null> {
  if (isHostLibraryEnabled()) {
    const pack =
      getCoreNpcCreatureDefinition(definitionId) ??
      getBuiltinNpcCreatureDefinition(definitionId);
    if (pack) {
      // Assign ownership via property write — facade must not invent owners in literals.
      const record = {
        definition: pack,
        status: 'active' as const,
        worldProfileId: null,
        publicId: null,
      } as NpcCreatureCatalogRecord;
      record.ownerUserId = '';
      return record;
    }
    const rows = await fetchHostLibraryNpcCreatures();
    return (
      rows
        .map(mapHostLibraryNpcRecord)
        .find((row): row is NpcCreatureCatalogRecord => row !== null && row.definition.id === definitionId) ??
      null
    );
  }
  return supabaseNpcCreatureRepository.getDefinitionById(definitionId);
}

function requireHostNpcRecord(raw: unknown, message: string): NpcCreatureCatalogRecord {
  const record = mapHostLibraryNpcRecord(raw);
  if (!record) throw new Error(message);
  return record;
}

export async function createNpcCreatureDefinition(
  input: CreateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  if (isHostLibraryEnabled()) {
    const created = await createHostLibraryNpcCreature({
      scope: input.target.scope,
      worldProfileId:
        input.target.scope === 'world' ? input.target.worldProfileId : null,
      draft: input.draft,
    });
    return requireHostNpcRecord(created, 'Host-NPC anlegen: ungültige Antwort');
  }
  return supabaseNpcCreatureRepository.createDefinition(input);
}

export async function updateNpcCreatureDefinition(
  input: UpdateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  if (isHostLibraryEnabled()) {
    const updated = await updateHostLibraryNpcCreature(
      input.definitionId,
      input.draft,
    );
    return requireHostNpcRecord(updated, 'Host-NPC speichern: ungültige Antwort');
  }
  return supabaseNpcCreatureRepository.updateDefinition(input);
}

export async function archiveNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  if (isHostLibraryEnabled()) {
    const archived = await archiveHostLibraryNpcCreature(definitionId);
    return requireHostNpcRecord(archived, 'Host-NPC archivieren: ungültige Antwort');
  }
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

function mapHostControllerAssignment(
  dto: HostNpcControllerAssignmentDto,
): NpcControllerAssignment {
  return {
    projectId: dto.projectId,
    definitionId: dto.definitionId,
    controllerUserId: dto.controllerUserId,
  };
}

/** Load controller assignment for a campaign + definition (#200 / CUT-02). */
export async function getNpcCreatureControllerAssignment(
  projectId: string,
  definitionId: string,
): Promise<NpcControllerAssignment | null> {
  if (isHostLibraryEnabled()) {
    const assignment = await fetchHostNpcCreatureControllerAssignment(projectId, definitionId);
    return assignment ? mapHostControllerAssignment(assignment) : null;
  }
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
 * Assign / clear controller (#200 / CUT-02).
 * Domain plan is a client hint only; host ports re-validate GM + membership.
 * Under host-first: Host HTTP — never Supabase RPC.
 */
export async function assignNpcCreatureController(input: {
  projectId: string;
  definitionId: string;
  controllerUserId: string | null;
  activeMemberUserIds: readonly string[];
}): Promise<NpcControllerAssignment> {
  const actorUserId = await getAuthenticatedUserId();
  const record = await getNpcCreatureDefinition(input.definitionId);
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

  if (isHostLibraryEnabled()) {
    const assignment = await assignHostNpcCreatureController({
      projectId: planned.assignment.projectId,
      definitionId: planned.assignment.definitionId,
      controllerUserId: planned.assignment.controllerUserId,
    });
    return mapHostControllerAssignment(assignment);
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
  if (isHostLibraryEnabled()) {
    const rows = await fetchHostLibraryNpcCreatures();
    for (const raw of rows) {
      const mapped = mapHostLibraryNpcRecord(raw);
      if (mapped?.definition.id === definitionId) return mapped.definition;
    }
    return null;
  }
  const record = await supabaseNpcCreatureRepository.getDefinitionById(definitionId);
  return record?.definition ?? null;
}

function mapHostInstanceDto(dto: HostNpcInstanceDto): NpcCreatureInstance {
  return toNpcCreatureInstance({
    id: dto.id,
    project_id: dto.projectId,
    session_id: dto.sessionId,
    definition_id: dto.definitionId,
    display_name: dto.displayName,
    instance_kind: dto.instanceKind,
    sequence_number: dto.sequenceNumber,
    snapshot: dto.snapshot,
    runtime: dto.runtime,
    created_by: dto.createdBy,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  });
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
  if (isHostLibraryEnabled()) {
    const rows = await fetchHostNpcInstances(projectId);
    return rows.map(mapHostInstanceDto);
  }
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
    isBuiltinOrCoreDefinitionId(definition.id) ||
    (isHostLibraryEnabled()
      ? true
      : Boolean(await supabaseNpcCreatureRepository.getDefinitionById(definition.id)));

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

  if (isHostLibraryEnabled()) {
    const instance = await spawnHostNpcInstance({
      projectId: planned.instance.projectId,
      definitionId: planned.instance.definitionId,
      instanceKind: planned.instance.instanceKind,
      snapshot: toInstanceSnapshotPayload(planned.instance.snapshot),
      runtime: toInstanceRuntimePayload(planned.instance.runtime),
      displayName: planned.instance.displayName,
      sequenceNumber: planned.instance.sequenceNumber,
      sessionId: planned.instance.sessionId,
    });
    return mapHostInstanceDto(instance);
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

  if (isHostLibraryEnabled()) {
    const instance = await updateHostNpcInstanceRuntime(
      planned.instance.id!,
      toInstanceRuntimePayload(planned.instance.runtime),
    );
    return mapHostInstanceDto(instance);
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
  if (isHostLibraryEnabled()) {
    await removeHostNpcInstance(instanceId);
    return;
  }
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
  if (isHostLibraryEnabled()) {
    return clearHostNpcTempControllersForSession(sessionId);
  }
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
