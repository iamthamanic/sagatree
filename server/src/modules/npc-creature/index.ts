/**
 * npc-creature module public API — quarantine + NPC instances (#819/#877).
 * Location: server/src/modules/npc-creature/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { ProjectPorts } from '../project/index.ts';
import {
  NpcInstanceStore,
  type ControllerAssignmentRow,
  type NpcInstanceRow,
} from './internal/npc-instance-store.ts';

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

export type NpcCreaturePorts = {
  readonly moduleId: 'npc-creature';
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
  }) => void;
};

export function createNpcCreaturePorts(deps: {
  readonly db: HostDatabase;
  readonly project: ProjectPorts;
}): NpcCreaturePorts {
  const store = new NpcInstanceStore(deps.db, deps.project);
  return {
    moduleId: 'npc-creature',
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
