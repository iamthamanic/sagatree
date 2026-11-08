/**
 * host-npc-creature-adapter — Binds infra HostNpcCreaturePorts to an injected host impl (MIG-307).
 * Location: src/infrastructure/npc-creature/host-npc-creature-adapter.ts
 *
 * Production UI uses host-library-http via npc-creature-service (CUT-02b).
 * This adapter remains the typed port seam for tests / injected host impls.
 * No server/ imports; no client role elevation.
 */
import type { HostNpcCreaturePorts } from './host-npc-creature-ports.contract';
import { HOST_NPC_CREATURE_OPS } from './host-npc-creature-ports.contract';

export type HostNpcCreatureAdapter = HostNpcCreaturePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_NPC_CREATURE_OPS;
};

/**
 * Wrap an injected HostNpcCreaturePorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostNpcCreatureAdapter(
  ports: HostNpcCreaturePorts,
): HostNpcCreatureAdapter {
  return {
    transport: 'host',
    ops: HOST_NPC_CREATURE_OPS,
    listDefinitions: (actorId, options) => ports.listDefinitions(actorId, options),
    getDefinition: (actorId, definitionId) => ports.getDefinition(actorId, definitionId),
    createDefinition: (actorId, input) => ports.createDefinition(actorId, input),
    updateDefinition: (actorId, definitionId, draft) =>
      ports.updateDefinition(actorId, definitionId, draft),
    archiveDefinition: (actorId, definitionId) =>
      ports.archiveDefinition(actorId, definitionId),
    restoreDefinition: (actorId, definitionId) =>
      ports.restoreDefinition(actorId, definitionId),
    duplicateDefinition: (actorId, sourceDefinitionId) =>
      ports.duplicateDefinition(actorId, sourceDefinitionId),
    getControllerAssignment: (actorId, projectId, definitionId) =>
      ports.getControllerAssignment(actorId, projectId, definitionId),
    assignController: (actorId, projectId, definitionId, controllerUserId) =>
      ports.assignController(actorId, projectId, definitionId, controllerUserId),
    listInstances: (actorId, projectId) => ports.listInstances(actorId, projectId),
    spawnInstance: (actorId, input) => ports.spawnInstance(actorId, input),
    updateRuntime: (actorId, instanceId, runtime) =>
      ports.updateRuntime(actorId, instanceId, runtime),
    removeInstance: (actorId, instanceId) => ports.removeInstance(actorId, instanceId),
    clearTempControllersForSession: (actorId, sessionId) =>
      ports.clearTempControllersForSession(actorId, sessionId),
  };
}
