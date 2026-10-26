/**
 * update_npc_creature_instance_runtime use-case (RPC-NPC-INSTANCES / #877).
 * Location: server/src/application/npc-instances/update_npc_creature_instance_runtime/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { NpcCreaturePorts } from '../../../modules/npc-creature/index.ts';

export function updateNpcCreatureInstanceRuntimeUseCase(npc: NpcCreaturePorts) {
  return (actor: Actor, instanceId: string, runtime: unknown) =>
    npc.updateRuntime(actor, instanceId, runtime);
}
