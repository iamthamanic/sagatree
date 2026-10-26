/**
 * remove_npc_creature_instance use-case (RPC-NPC-INSTANCES / #877).
 * Location: server/src/application/npc-instances/remove_npc_creature_instance/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { NpcCreaturePorts } from '../../../modules/npc-creature/index.ts';

export function removeNpcCreatureInstanceUseCase(npc: NpcCreaturePorts) {
  return (actor: Actor, instanceId: string) => npc.removeInstance(actor, instanceId);
}
