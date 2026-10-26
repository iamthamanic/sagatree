/**
 * Minimal durable PC rows for project-membership character binding (#874).
 * Private — import only from character public API.
 * Location: server/src/modules/character/internal/character-membership-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type CharacterMembershipCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: '42501' | '22023' };

export type SeededPc = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly sheetStatus: 'complete' | 'incomplete' | 'draft';
  readonly name: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class CharacterMembershipStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  /**
   * Postgres join/set_my character guard: owned PC with complete sheet (or NULL skip).
   */
  assertOwnedCompletePc(ownerUserId: string, characterId: string): CharacterMembershipCheck {
    const row = this.#db
      .prepare(
        `SELECT sheet_status AS sheetStatus, character_type AS characterType
         FROM characters
         WHERE id = ? AND owner_user_id = ? AND character_type = 'pc'`,
      )
      .get(characterId, ownerUserId) as
      | { sheetStatus: string; characterType: string }
      | undefined;

    if (!row) return { ok: false, error: '42501' };
    if ((row.sheetStatus ?? 'complete') !== 'complete') return { ok: false, error: '22023' };
    return { ok: true };
  }

  seedPcForTests(input: {
    readonly ownerUserId: string;
    readonly name?: string;
    readonly sheetStatus?: 'complete' | 'incomplete' | 'draft';
    readonly id?: string;
  }): SeededPc {
    const id = input.id ?? randomUUID();
    const sheetStatus = input.sheetStatus ?? 'complete';
    const name = input.name ?? 'Test PC';
    this.#db
      .prepare(
        `INSERT INTO characters (id, owner_user_id, character_type, sheet_status, name, created_at)
         VALUES (?, ?, 'pc', ?, ?, ?)`,
      )
      .run(id, input.ownerUserId, sheetStatus, name, nowIso());
    return { id, ownerUserId: input.ownerUserId, sheetStatus, name };
  }
}
