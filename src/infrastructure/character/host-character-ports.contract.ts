/**
 * Host-aligned character ports contract (MIG-302 / #801).
 * Location: src/infrastructure/character/host-character-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/character` sheet infra ports.
 * Supabase facades remain live until cutover; this documents the host shape
 * for parity checks without importing the Node host package.
 */

export type HostCharacterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type HostCharacterSheetRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly ownerUserId: string;
  readonly characterType: 'pc' | 'npc' | 'gm_presence';
  readonly sheetStatus: 'complete' | 'incomplete' | 'draft';
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly sheet: Readonly<Record<string, unknown>>;
  readonly portraitStoragePath: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type HostCharacterPresetRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly visibility: 'public' | 'owner';
  readonly ownerUserId: string | null;
  readonly sheet: Readonly<Record<string, unknown>>;
};

export type HostCharacterDraft = {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly level?: unknown;
  readonly sheetStatus?: unknown;
  readonly sheet?: unknown;
  readonly portraitStoragePath?: unknown;
  readonly characterType?: unknown;
};

/**
 * Actor id is the verified host actor — never a client-claimed owner.
 * Ports mirror host createCharacterPorts sheet surface (no HTTP in this slice).
 */
export type HostCharacterPorts = {
  readonly listOwnedCharacters: (
    actorId: string,
  ) => Promise<HostCharacterResult<readonly HostCharacterSheetRecord[]>>;
  readonly getOwnedCharacter: (
    actorId: string,
    characterId: string,
  ) => Promise<HostCharacterResult<HostCharacterSheetRecord | null>>;
  readonly createOwnedCharacter: (
    actorId: string,
    draft: HostCharacterDraft,
  ) => Promise<HostCharacterResult<HostCharacterSheetRecord>>;
  readonly updateOwnedCharacter: (
    actorId: string,
    characterId: string,
    draft: HostCharacterDraft,
  ) => Promise<HostCharacterResult<HostCharacterSheetRecord>>;
  readonly deleteOwnedCharacter: (
    actorId: string,
    characterId: string,
  ) => Promise<HostCharacterResult<{ readonly id: string }>>;
  readonly listReadablePresets: (
    actorId: string,
  ) => Promise<HostCharacterResult<readonly HostCharacterPresetRecord[]>>;
  readonly resolveOwnedArtifact: (
    actorId: string,
    storagePath: string,
  ) => Promise<
    HostCharacterResult<{ readonly storagePath: string; readonly characterId: string }>
  >;
};

export const HOST_CHARACTER_OPS = [
  'listOwnedCharacters',
  'getOwnedCharacter',
  'createOwnedCharacter',
  'updateOwnedCharacter',
  'deleteOwnedCharacter',
  'listReadablePresets',
  'resolveOwnedArtifact',
] as const;
