/**
 * spawn_npc_creature_instance use-case (RPC-NPC-INSTANCES / #877).
 * Location: server/src/application/npc-instances/spawn_npc_creature_instance/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { NpcCreaturePorts } from '../../../modules/npc-creature/index.ts';

export function spawnNpcCreatureInstanceUseCase(npc: NpcCreaturePorts) {
  return (
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
  ) => npc.spawnInstance(actor, input);
}
