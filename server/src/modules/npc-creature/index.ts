/**
 * npc-creature module public API — quarantine + definition CRUD + NPC instances
 * (#819/#833/#877/#806).
 * Location: server/src/modules/npc-creature/index.ts
 *
 * Definition/instance HTTP publicActivation remains false (cutover → MIG-600).
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { ProjectPorts } from '../project/index.ts';
import {
  NpcInstanceStore,
  type ControllerAssignmentRow,
  type NpcDefinitionRecord,
  type NpcInstanceRow,
  type NpcSessionLookup,
  type NpcWorldLookup,
} from './internal/npc-instance-store.ts';

export type { NpcSessionLookup, NpcWorldLookup, NpcDefinitionRecord };

/** Host NPC definition/instance ports are transport-free until MIG-600. */
export const NPC_CREATURE_PORTS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export {
  BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED,
  applyMonsterDefaults,
  calculateXp,
  computeEncounterXp,
  filterMonsters,
  parseChallengeRating,
  searchMonsters,
  type QuarantineMonster,
} from './internal/bestiary-quarantine.ts';

export {
  NPCS_MAP_IS_NPC_CREATURE_POLICY,
  NPCS_PUBLIC_ACTIVATION_AUTHORIZED,
  NPC_CLASSES,
  NPC_DISPOSITIONS,
  NPC_LOCATIONS,
  NPC_RACE_NAMES,
  applyNpcCreateDefaults,
  applyNpcImportDefaults,
  buildDialogueLine,
  createSeededRng,
  describeNpcsLegacyDefects,
  generateDescription,
  generateNpc,
  generateStats,
  parseNpcStats,
  setRelationship,
  sliceMemories,
  type QuarantineDialogueLine,
  type QuarantineNpc,
  type QuarantineNpcStats,
} from './internal/npcs-quarantine.ts';

export type { ControllerAssignmentRow, NpcInstanceRow };

function actorIds(actor: Actor | null | undefined): readonly string[] {
  if (!actor?.actorId) return [];
  if (actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)) {
    return [
      actor.actorId,
      ...actor.linkedSoloActorIds.filter((id) => typeof id === 'string' && id.length > 0),
    ];
  }
  return [actor.actorId];
}

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

export type NpcCreatureResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type NpcCreaturePorts = {
  readonly moduleId: 'npc-creature';
  readonly listDefinitions: (
    actor: Actor,
    options?: {
      readonly scope?: 'personal' | 'world' | 'core' | 'builtin';
      readonly worldProfileId?: string | null;
      readonly includeArchived?: boolean;
    },
  ) => NpcCreatureResult<readonly NpcDefinitionRecord[]>;
  readonly getDefinition: (
    actor: Actor,
    definitionId: string,
  ) => NpcCreatureResult<NpcDefinitionRecord | null>;
  readonly createDefinition: (
    actor: Actor,
    input: {
      readonly scope: 'personal' | 'world';
      readonly worldProfileId?: string | null;
      readonly draft: unknown;
    },
  ) => NpcCreatureResult<NpcDefinitionRecord>;
  readonly updateDefinition: (
    actor: Actor,
    definitionId: string,
    draft: unknown,
  ) => NpcCreatureResult<NpcDefinitionRecord>;
  readonly archiveDefinition: (
    actor: Actor,
    definitionId: string,
  ) => NpcCreatureResult<NpcDefinitionRecord>;
  readonly restoreDefinition: (
    actor: Actor,
    definitionId: string,
  ) => NpcCreatureResult<NpcDefinitionRecord>;
  readonly duplicateDefinition: (
    actor: Actor,
    sourceDefinitionId: string,
  ) => NpcCreatureResult<NpcDefinitionRecord>;
  readonly assignController: (
    actor: Actor,
    projectId: string,
    definitionId: string,
    controllerUserId: string | null,
  ) =>
    | { readonly ok: true; readonly value: ControllerAssignmentRow }
    | { readonly ok: false; readonly error: string };
  readonly spawnInstance: (
    actor: Actor,
    input: {
      readonly projectId: string;
      readonly definitionId: string;
      readonly instanceKind: string;
      readonly snapshot: unknown;
      readonly runtime: unknown;
      readonly displayName: string;
      readonly sequenceNumber: number;
      readonly sessionId?: string | null;
    },
  ) =>
    | { readonly ok: true; readonly value: NpcInstanceRow }
    | { readonly ok: false; readonly error: string };
  readonly updateRuntime: (
    actor: Actor,
    instanceId: string,
    runtime: unknown,
  ) =>
    | { readonly ok: true; readonly value: NpcInstanceRow }
    | { readonly ok: false; readonly error: string };
  readonly removeInstance: (
    actor: Actor,
    instanceId: string,
  ) =>
    | { readonly ok: true; readonly value: { readonly id: string } }
    | { readonly ok: false; readonly error: string };
  readonly clearTempControllersForSession: (
    actor: Actor,
    sessionId: string,
  ) =>
    | { readonly ok: true; readonly value: { readonly cleared: number } }
    | { readonly ok: false; readonly error: string };
  readonly seedDefinitionForTests: (input: {
    readonly id: string;
    readonly scope: 'personal' | 'world' | 'core' | 'builtin';
    readonly ownerUserId?: string | null;
    readonly worldProfileId?: string | null;
    readonly status?: 'active' | 'archived';
    readonly sheetMode?: string;
    readonly publicId?: string;
  }) => void;
};

export function createNpcCreaturePorts(deps: {
  readonly db: HostDatabase;
  readonly project: ProjectPorts;
  readonly session: NpcSessionLookup;
  readonly world: NpcWorldLookup;
}): NpcCreaturePorts {
  const store = new NpcInstanceStore(deps.db, deps.project, deps.session, deps.world);
  return {
    moduleId: 'npc-creature',
    listDefinitions(actor, options) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.listDefinitions(actorIds(actor), options);
    },
    getDefinition(actor, definitionId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.getDefinition(actorIds(actor), definitionId);
    },
    createDefinition(actor, input) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.createDefinition(actorIds(actor), input);
    },
    updateDefinition(actor, definitionId, draft) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.updateDefinition(actorIds(actor), definitionId, draft);
    },
    archiveDefinition(actor, definitionId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.setDefinitionStatus(actorIds(actor), definitionId, 'archived');
    },
    restoreDefinition(actor, definitionId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.setDefinitionStatus(actorIds(actor), definitionId, 'active');
    },
    duplicateDefinition(actor, sourceDefinitionId) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      return store.duplicateDefinition(actorIds(actor), sourceDefinitionId);
    },
    assignController(actor, projectId, definitionId, controllerUserId) {
      return store.assignController(actorIds(actor), projectId, definitionId, controllerUserId);
    },
    spawnInstance(actor, input) {
      return store.spawnInstance(actorIds(actor), input);
    },
    updateRuntime(actor, instanceId, runtime) {
      return store.updateRuntime(actorIds(actor), instanceId, runtime);
    },
    removeInstance(actor, instanceId) {
      return store.removeInstance(actorIds(actor), instanceId);
    },
    clearTempControllersForSession(actor, sessionId) {
      return store.clearTempControllersForSession(actorIds(actor), sessionId);
    },
    seedDefinitionForTests: (input) => store.seedDefinitionForTests(input),
  };
}

export function createNpcCreaturePortsStub(): NpcCreaturePorts {
  const unavailable = { ok: false as const, error: 'store-unavailable' };
  return {
    moduleId: 'npc-creature',
    listDefinitions: () => unavailable,
    getDefinition: () => unavailable,
    createDefinition: () => unavailable,
    updateDefinition: () => unavailable,
    archiveDefinition: () => unavailable,
    restoreDefinition: () => unavailable,
    duplicateDefinition: () => unavailable,
    assignController: () => unavailable,
    spawnInstance: () => unavailable,
    updateRuntime: () => unavailable,
    removeInstance: () => unavailable,
    clearTempControllersForSession: () => unavailable,
    seedDefinitionForTests: () => undefined,
  };
}
