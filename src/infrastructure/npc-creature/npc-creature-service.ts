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
  duplicateHostLibraryNpcCreature,
  fetchHostLibraryNpcCreatureById,
  fetchHostLibraryNpcCreatures,
  fetchHostNpcCreatureControllerAssignment,
  fetchHostNpcInstances,
  isHostLibraryEnabled,
  removeHostNpcInstance,
  restoreHostLibraryNpcCreature,
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
  const rows = await fetchHostLibraryNpcCreatures({
    scope: options?.scope,
    worldProfileId: options?.worldProfileId,
    includeArchived: options?.includeArchived === true,
  });
  return rows
    .map(mapHostLibraryNpcRecord)
    .filter((record): record is NpcCreatureCatalogRecord => record !== null);
}

export async function getNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord | null> {
  const pack =
    getCoreNpcCreatureDefinition(definitionId) ??
    getBuiltinNpcCreatureDefinition(definitionId);
  if (pack) {
    const record = {
      definition: pack,
      status: 'active' as const,
      worldProfileId: null,
      publicId: null,
    } as NpcCreatureCatalogRecord;
    record.ownerUserId = '';
    return record;
  }
  assertHost();
  const raw = await fetchHostLibraryNpcCreatureById(definitionId);
  return raw ? mapHostLibraryNpcRecord(raw) : null;
}

function requireHostNpcRecord(raw: unknown, message: string): NpcCreatureCatalogRecord {
  const record = mapHostLibraryNpcRecord(raw);
  if (!record) throw new Error(message);
  return record;
}

export async function createNpcCreatureDefinition(
  input: CreateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  assertHost();
  const created = await createHostLibraryNpcCreature({
    scope: input.target.scope,
    worldProfileId:
      input.target.scope === 'world' ? input.target.worldProfileId : null,
    draft: input.draft,
  });
  return requireHostNpcRecord(created, 'Host-NPC anlegen: ungültige Antwort');
}

export async function updateNpcCreatureDefinition(
  input: UpdateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  assertHost();
  const updated = await updateHostLibraryNpcCreature(
    input.definitionId,
    input.draft,
  );
  return requireHostNpcRecord(updated, 'Host-NPC speichern: ungültige Antwort');
}

export async function archiveNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  assertHost();
  const archived = await archiveHostLibraryNpcCreature(definitionId);
  return requireHostNpcRecord(archived, 'Host-NPC archivieren: ungültige Antwort');
}

function personalCopyName(sourceName: string): string {
  const suffix = ' (Kopie)';
  const maxBase = Math.max(1, 255 - suffix.length);
  return `${sourceName.trim().slice(0, maxBase) || 'NPC'}${suffix}`;
}

/**
 * Clone any library definition into a new personal row with “(Kopie)” name.
 * Persisted defs → host `duplicateDefinition` port.
 * Core/builtin packs (no DB row) → host create with personal copy draft.
 */
export async function duplicateNpcCreatureDefinition(
  definitionId: string,
  sourceDefinition?: NpcCreatureDefinition,
): Promise<NpcCreatureCatalogRecord> {
  assertHost();
  const pack =
    getCoreNpcCreatureDefinition(definitionId) ??
    getBuiltinNpcCreatureDefinition(definitionId) ??
    (sourceDefinition &&
    (sourceDefinition.scope === 'core' || sourceDefinition.scope === 'builtin')
      ? sourceDefinition
      : null);
  if (pack) {
    const { id: _id, scope: _scope, ...rest } = pack;
    return createNpcCreatureDefinition({
      target: { scope: 'personal' },
      draft: { ...rest, name: personalCopyName(rest.name) },
    });
  }
  const duplicated = await duplicateHostLibraryNpcCreature(definitionId);
  return requireHostNpcRecord(duplicated, 'Host-NPC duplizieren: ungültige Antwort');
}

/** Restore archived definition via host `restoreDefinition` port (#1159 / CUT-02b). */
export async function restoreNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  assertHost();
  const restored = await restoreHostLibraryNpcCreature(definitionId);
  return requireHostNpcRecord(restored, 'Host-NPC wiederherstellen: ungültige Antwort');
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
  return listNpcCreatureDefinitions({
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
 * Compose effective NPC/creature availability for a world profile (#199 / CUT-02b).
 * Host-first: filtered library list HTTP; module config uses domain defaults
 * (world payload modules not yet a product surface for NPC catalog).
 */
export async function loadWorldNpcCreatureAvailability(
  worldProfileId: string,
): Promise<WorldNpcCreatureAvailability> {
  assertHost();
  const modules = null;
  const [worldRecords, personalRecords] = await Promise.all([
    loadWorldProfileNpcCreatureCatalog(worldProfileId),
    listNpcCreatureDefinitions({
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
 * Compact → Full (#200 / CUT-02b): host get + updateDefinition (same id).
 * No Soft-DENY; owner ACL enforced by host update port.
 */
export async function promoteNpcCreatureCompactToFull(input: {
  definitionId: string;
  fullSheet: Readonly<Record<string, unknown>>;
}): Promise<NpcCreatureCatalogRecord> {
  const attrsCheck = assertFullSheetHasNoSilentIllegalAttributes(input.fullSheet);
  if (attrsCheck.ok === false) {
    throw new Error(attrsCheck.message);
  }

  assertHost();
  const existing = await getNpcCreatureDefinition(input.definitionId);
  if (!existing) {
    throw new Error('Figur wurde nicht gefunden.');
  }

  const draft = buildCompactToFullWriteDraft(existing.definition, input.fullSheet);
  if (!draft) {
    throw new Error('Compact→Full-Entwurf ungültig — Full Sheet fehlt oder ist leer.');
  }

  return updateNpcCreatureDefinition({
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
  assertHost();
  const assignment = await fetchHostNpcCreatureControllerAssignment(projectId, definitionId);
  return assignment ? mapHostControllerAssignment(assignment) : null;
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

  assertHost();
  const assignment = await assignHostNpcCreatureController({
    projectId: planned.assignment.projectId,
    definitionId: planned.assignment.definitionId,
    controllerUserId: planned.assignment.controllerUserId,
  });
  return mapHostControllerAssignment(assignment);
}

async function resolveDefinitionForInstance(
  definitionId: string,
): Promise<NpcCreatureDefinition | null> {
  const builtin = getBuiltinNpcCreatureDefinition(definitionId);
  if (builtin) return builtin;
  const core = getCoreNpcCreatureDefinition(definitionId);
  if (core) return core;
  const record = await getNpcCreatureDefinition(definitionId);
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
  assertHost();
  const rows = await fetchHostNpcInstances(projectId);
  return rows.map(mapHostInstanceDto);
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
    Boolean(await getNpcCreatureDefinition(definition.id));

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

  assertHost();
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

  assertHost();
  const instance = await updateHostNpcInstanceRuntime(
    planned.instance.id!,
    toInstanceRuntimePayload(planned.instance.runtime),
  );
  return mapHostInstanceDto(instance);
}

/** Remove an instance from the adventure (#201). Does not archive the definition. */
export async function removeNpcCreatureInstance(instanceId: string): Promise<void> {
  assertHost();
  await removeHostNpcInstance(instanceId);
}

/**
 * Session end: clear temporary controllers on session-scoped instances only (#201).
 * Does not touch campaign controller assignments (#200).
 */
export async function clearNpcCreatureInstanceTempControllersForSession(
  sessionId: string,
): Promise<number> {
  assertHost();
  return clearHostNpcTempControllersForSession(sessionId);
}
