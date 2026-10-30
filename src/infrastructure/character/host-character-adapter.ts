/**
 * host-character-adapter — Binds infra HostCharacterPorts to an injected host impl (MIG-302).
 * Location: src/infrastructure/character/host-character-adapter.ts
 *
 * Production UI still calls Supabase character-service facades. This adapter is the
 * typed dual-path seam: tests and future host transport inject HostCharacterPorts.
 * No server/ imports; no client role elevation.
 */
import type { HostCharacterPorts } from './host-character-ports.contract';
import { HOST_CHARACTER_OPS } from './host-character-ports.contract';

export type HostCharacterAdapter = HostCharacterPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_CHARACTER_OPS;
};

/**
 * Wrap an injected HostCharacterPorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostCharacterAdapter(ports: HostCharacterPorts): HostCharacterAdapter {
  return {
    transport: 'host',
    ops: HOST_CHARACTER_OPS,
    listOwnedCharacters: (actorId) => ports.listOwnedCharacters(actorId),
    getOwnedCharacter: (actorId, characterId) => ports.getOwnedCharacter(actorId, characterId),
    createOwnedCharacter: (actorId, draft) => ports.createOwnedCharacter(actorId, draft),
    updateOwnedCharacter: (actorId, characterId, draft) =>
      ports.updateOwnedCharacter(actorId, characterId, draft),
    deleteOwnedCharacter: (actorId, characterId) =>
      ports.deleteOwnedCharacter(actorId, characterId),
    listReadablePresets: (actorId) => ports.listReadablePresets(actorId),
    resolveOwnedArtifact: (actorId, storagePath) =>
      ports.resolveOwnedArtifact(actorId, storagePath),
  };
}
