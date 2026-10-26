/**
 * assign_npc_creature_controller use-case (RPC-NPC-INSTANCES / #877).
 * Location: server/src/application/npc-instances/assign_npc_creature_controller/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { NpcCreaturePorts } from '../../../modules/npc-creature/index.ts';

export function assignNpcCreatureControllerUseCase(npc: NpcCreaturePorts) {
  return (actor: Actor, projectId: string, definitionId: string, controllerUserId: string | null) =>
    npc.assignController(actor, projectId, definitionId, controllerUserId);
}
