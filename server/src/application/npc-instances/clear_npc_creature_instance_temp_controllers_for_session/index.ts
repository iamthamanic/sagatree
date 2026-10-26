/**
 * clear_npc_creature_instance_temp_controllers_for_session use-case (#877).
 * Location: server/src/application/npc-instances/clear_npc_creature_instance_temp_controllers_for_session/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { NpcCreaturePorts } from '../../../modules/npc-creature/index.ts';

export function clearNpcCreatureInstanceTempControllersForSessionUseCase(npc: NpcCreaturePorts) {
  return (actor: Actor, sessionId: string) => npc.clearTempControllersForSession(actor, sessionId);
}
