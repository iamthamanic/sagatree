/**
 * Character-owned inventory column IO for MIG-303 (#802).
 * Location: server/src/modules/character/internal/character-inventory-columns.ts
 *
 * characters.inventory_* columns live on the character-owned table; inventory
 * module must not UPDATE characters directly — inject this port instead.
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type CharacterInventoryColumnsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type CharacterInventoryColumnsRecord = {
  readonly characterId: string;
  readonly schemaVersion: number;
  readonly inventoryJson: string;
  readonly updatedAt: string;
};

type PcInvRow = {
  id: string;
  owner_user_id: string;
  character_type: string;
  deleted_at: string | null;
  inventory_schema_version: number;
  inventory_json: string;
  updated_at: string | null;
  created_at: string;
};

export class CharacterInventoryColumnsStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  getOwned(
    actorId: string,
    characterId: string,
  ): CharacterInventoryColumnsResult<CharacterInventoryColumnsRecord | null> {
    const any = this.#db
      .prepare(
        `SELECT id, owner_user_id, character_type, deleted_at, inventory_schema_version,
                inventory_json, updated_at, created_at
         FROM characters
         WHERE id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
      )
      .get(characterId) as PcInvRow | undefined;
    if (!any) return { ok: true, value: null };
    if (any.owner_user_id !== actorId) return { ok: false, error: 'not-authorized' };
    return {
      ok: true,
      value: {
        characterId: any.id,
        schemaVersion: Number(any.inventory_schema_version) || 0,
        inventoryJson: any.inventory_json,
        updatedAt: any.updated_at ?? any.created_at,
      },
    };
  }

  /**
   * Replace inventory_json / schema_version for an owned PC under IMMEDIATE lock.
   * Caller (inventory) must validate payload shape before invoking.
   * Optional `revalidateUnderLock` re-checks invariants after the write lock (TOCTOU).
   */
  putOwned(
    actorId: string,
    characterId: string,
    inventoryJson: string,
    schemaVersion: number,
    updatedAt: string,
    revalidateUnderLock: () => CharacterInventoryColumnsResult<true>,
  ): CharacterInventoryColumnsResult<CharacterInventoryColumnsRecord> {
    let inTx = false;
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      inTx = true;
      const locked = this.#db
        .prepare(
          `SELECT id, owner_user_id, character_type, deleted_at, inventory_schema_version,
                  inventory_json, updated_at, created_at
           FROM characters
           WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
        )
        .get(characterId, actorId) as PcInvRow | undefined;
      if (!locked) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        const any = this.#db
          .prepare(
            `SELECT owner_user_id AS ownerUserId FROM characters
             WHERE id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
          )
          .get(characterId) as { ownerUserId: string } | undefined;
        if (any && any.ownerUserId !== actorId) {
          return { ok: false, error: 'not-authorized' };
        }
        return { ok: false, error: 'not-found' };
      }
      const recheck = revalidateUnderLock();
      if (!recheck.ok) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        return recheck;
      }
      const changed = this.#db
        .prepare(
          `UPDATE characters SET
             inventory_json = ?, inventory_schema_version = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
        )
        .run(inventoryJson, schemaVersion, updatedAt, characterId, actorId);
      if (changed.changes !== 1) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        return { ok: false, error: 'not-found' };
      }
      this.#db.exec('COMMIT');
      inTx = false;
    } catch {
      if (inTx) {
        try {
          this.#db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }
      return { ok: false, error: 'update-failed' };
    }
    const next = this.getOwned(actorId, characterId);
    if (!next.ok || !next.value) return { ok: false, error: 'not-found' };
    return { ok: true, value: next.value };
  }
}
