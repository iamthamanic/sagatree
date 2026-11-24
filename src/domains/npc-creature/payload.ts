/**
 * NPC/creature definition payload versioning (#196).
 * Location: src/domains/npc-creature/payload.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

/** Version stamped into persisted definition payloads. */
export const NPC_CREATURE_DEFINITION_PAYLOAD_VERSION = 1 as const;

export type NpcCreatureDefinitionPayloadVersion =
  typeof NPC_CREATURE_DEFINITION_PAYLOAD_VERSION;
